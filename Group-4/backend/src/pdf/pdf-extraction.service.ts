// DOSYA REHBERİ: Yüklenen PDF dosyasından metin çıkaran ve bunu güvenli hâle
// getiren servis. Dosyanın gerçekten PDF olup olmadığını (uzantıya değil
// dosyanın ilk baytlarına bakarak — çünkü uzantı/Content-Type kolayca sahte
// olabilir), boyutunun sınırı aşmadığını kontrol eder ve çıkardığı metni
// belli bir karakter sınırıyla keser (aksi hâlde dev bir PDF, LLM'e
// gönderilecek metni aşırı şişirebilirdi).
import { createHash } from 'node:crypto';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { extractText, getDocumentProxy } from 'unpdf';
import { TtlCache } from '../common/ttl-cache';

// PDF metin cikarma — FR-002. Somut kutuphane ADR-0009'a bagli; bu servis
// SOZLESMEYI sabitler, kutuphane degisirse yalnizca extract() govdesi degisir.
// Gecici secim: unpdf (saf JS, native derleme bagimliligi YOK — research.md 3).

const PDF_MIME = 'application/pdf';

// PDF dosyalari `%PDF-` ile baslar (PDF 32000-1, 7.5.2).
const PDF_MAGIC = Buffer.from('%PDF-', 'ascii');

/**
 * Icerikten tur dogrulamasi — docs/SECURITY.md S10.
 *
 * Sihirli bayt her zaman dosyanin ILK baytindan baslamak zorunda degildir:
 * bazi uretici araclar onune BOM veya birkac bos satir koyar ve gercek okuyucular
 * bunu kabul eder. Bu yuzden yalnizca bastaki kucuk bir pencerede aranir —
 * tum dosyayi taramak, govdesinde `%PDF-` gecen herhangi bir dosyayi
 * gecirirdi ve kontrolun anlami kalmazdi.
 */
function hasPdfMagicBytes(buffer: Buffer): boolean {
  const SEARCH_WINDOW = 1024;
  return buffer.subarray(0, SEARCH_WINDOW).includes(PDF_MAGIC);
}

// PDF_MAX_SIZE_MB tanimsizsa gecerli varsayilan (env.validation.ts ile AYNI).
const DEFAULT_MAX_SIZE_MB = 10;

// Multer sinirinin servis sinirinin UZERINE konuldugu pay (MB).
const UPLOAD_HARD_LIMIT_HEADROOM_MB = 1;

/**
 * Multer'in `limits.fileSize` secenegi icin SERT ust sinir (bayt).
 *
 * docs/SECURITY.md S4: servisin kendi boyut kontrolu multer dosyayi tamamen
 * BELLEGE ALDIKTAN sonra calisir — sinirsiz birakilirsa 500 MB'lik bir istek
 * once RAM'e yazilip sonra reddedilirdi.
 *
 * NEDEN TAM OLARAK PDF_MAX_SIZE_MB DEGIL: multer sinira takildiginda kendi
 * hatasini atar (Nest bunu 413'e cevirir) ve `PdfTooLargeError`in Turkce mesaji
 * ile `details.maxSizeMb` alani kaybolurdu. Sert sinir bir MB yukari konarak
 * iki katman ayrilir:
 *   - sinirin hemen ustu (10-11 MB) -> servise ulasir, sozlesmedeki Turkce 400
 *   - cok buyuk govde (>11 MB)      -> multer govdeyi okurken keser, 413
 * Bellek korumasi asil buyuk govdelere karsidir; 11 MB'i tamponlamak zararsizdir.
 *
 * Interceptor dekoratoru sinif tanimlanirken degerlendigi icin ConfigService
 * enjekte edilemez; deger process.env'den okunur ve varsayilani yukaridaki
 * sabitten alir — iki katmanin sinirlari boylece ayrisamaz.
 */
export function resolveUploadHardLimitBytes(): number {
  const parsed = Number(process.env.PDF_MAX_SIZE_MB);
  const maxSizeMb =
    Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_SIZE_MB;
  return (maxSizeMb + UPLOAD_HARD_LIMIT_HEADROOM_MB) * 1024 * 1024;
}

// Prompt injection savunmasi (docs/API_CONVENTIONS.md 5): cikarilan metne de
// ust sinir uygulanir; 10 MB'lik bir PDF milyonlarca karakter tasiyabilir.
const MAX_EXTRACTED_CHARS = 40_000;

// C5 — ayni dosya iki kez ayristirilmaz.
//
// NEDEN: en sik tekrar eden girdi OZGECMIS. Kullanici her yeni gorusmede ayni
// CV'yi yukler; PDF.js ayristirmasi saf JS'tir, yani sureyi Node'un TEK olay
// dongusunden yer — o sirada diger istekler de bekler. Ayni baytlar icin bunu
// tekrar odemek gereksiz.
//
// ANAHTAR ICERIGIN SHA-256'SI (dosya adi/kullanici degil): iki kullanici ayni
// baytlari yuklerse cikan metin zaten AYNIDIR, yani icerik-adresli anahtar
// capraz kullanici sizinti riski tasimaz. Dosya adiyla anahtarlansaydi
// "ozgecmis.pdf" herkeste ayni anahtar olur ve BASKASININ metnini dondururdu.
//
// ponytail: sabit sure/tavan, env dugmesi yok. Tavan 50 kayit x <=40 KB metin
// = birkac MB. Ayarlanabilirlik gerekirse env'e cikarilir.
const EXTRACTION_CACHE_TTL_MS = 60 * 60 * 1000;
const extractionCache = new TtlCache<string>(EXTRACTION_CACHE_TTL_MS, 50);

export class PdfUnsupportedTypeError extends HttpException {
  constructor() {
    super(
      { message: 'Yalnizca PDF dosyasi yukleyebilirsiniz.' },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PdfTooLargeError extends HttpException {
  constructor(maxSizeMb: number) {
    super(
      {
        message: `PDF dosyasi en fazla ${maxSizeMb} MB olabilir.`,
        details: { maxSizeMb },
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class PdfExtractionFailedError extends HttpException {
  constructor(cause?: unknown) {
    super(
      {
        message:
          'PDF icindeki metin okunamadi. Metni dogrudan yapistirmayi deneyin.',
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
      { cause },
    );
  }
}

@Injectable()
export class PdfExtractionService {
  constructor(private readonly config: ConfigService) {}

  private get maxSizeMb(): number {
    return this.config.get<number>('PDF_MAX_SIZE_MB', DEFAULT_MAX_SIZE_MB);
  }

  async extractText(buffer: Buffer, mimeType: string): Promise<string> {
    // docs/SECURITY.md S10: `mimeType` multipart part'inin Content-Type'idir,
    // yani ISTEMCININ beyanidir ve sahtelenebilir. Beyan ucuz bir on eleme
    // olarak korunur, ama tur asil ICERIKTEN dogrulanir.
    if (mimeType !== PDF_MIME) throw new PdfUnsupportedTypeError();
    if (buffer.length > this.maxSizeMb * 1024 * 1024) {
      throw new PdfTooLargeError(this.maxSizeMb);
    }
    // Boyuttan SONRA: sinir ustu bir dosya "cok buyuk" yanitini almali,
    // icerigi ne olursa olsun "desteklenmeyen tur" degil.
    if (!hasPdfMagicBytes(buffer)) throw new PdfUnsupportedTypeError();

    // Onbellek dogrulamalardan SONRA: gecersiz bir dosya once kendi hatasini
    // almali, onbellekten gecerli bir metin degil.
    const key = createHash('sha256').update(buffer).digest('hex');
    const cached = extractionCache.get(key);
    if (cached !== undefined) return cached;

    let text: string;
    try {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      ({ text } = await extractText(pdf, { mergePages: true }));
    } catch (cause) {
      throw new PdfExtractionFailedError(cause);
    }

    const normalized = text.replace(/\s+/g, ' ').trim();
    // Taranmis (goruntu) PDF: sayfa var ama metin katmani yok -> 422.
    if (normalized.length === 0) throw new PdfExtractionFailedError();

    const result = normalized.slice(0, MAX_EXTRACTED_CHARS);
    extractionCache.set(key, result);
    return result;
  }
}
