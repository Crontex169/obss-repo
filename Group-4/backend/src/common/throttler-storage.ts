// DOSYA REHBERİ: Hız sınırı sayaçlarının NEREDE tutulacağına karar veren tek
// yer. `REDIS_URL` verilmişse sayaçlar Redis'te (uygulama örnekleri arasında
// paylaşımlı), verilmemişse kütüphanenin varsayılan süreç-içi belleğinde tutulur.
import { Logger } from '@nestjs/common';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import type { ThrottlerStorage } from '@nestjs/throttler';

const logger = new Logger('ThrottlerStorage');

/**
 * Surec-yerel sayacin iki somut arizasi vardir:
 *   1. COK ORNEKLI dagitim: her ornek kendi sayacini tutar, yani gercek sinir
 *      ornek sayisiyla CARPILIR (iki ornek = iki kat istek hakki).
 *   2. YENIDEN BASLATMA: sayaclar sifirlanir; sinira dayanmis bir istemci
 *      deploy aninda temiz sayfayla devam eder.
 *
 * Redis ikisini de kaldirir. Yine de ZORUNLU DEGILDIR: `REDIS_URL` yoksa
 * varsayilan bellek deposu kullanilir - gelistirme ve testler ek bir servis
 * ayaga kaldirmadan calisir. Uretimde tek ornek kosuluyorsa da gecerli bir
 * secimdir; istenen, kararin BILINCLI olmasidir (baslangicta loglanir).
 *
 * Donen `undefined`, ThrottlerModule'e "sen bildigin gibi yap" demektir.
 *
 * ENTEGRASYON TESTLERI BU YOLU KULLANIR (REDIS_URL verilmez): test izolasyonu
 * "her spec dosyasi kendi uygulamasini, dolayisiyla kendi sayac deposunu
 * kurar" varsayimina dayanir. Paylasimli depoda global kovayi bilerek tuketen
 * test (security-global-throttle.spec.ts) sonraki dosyalari 429'a dusururdu.
 */
export function createThrottlerStorage(
  redisUrl: string | undefined,
): ThrottlerStorage | undefined {
  if (!redisUrl) {
    logger.log(
      'Hiz siniri sayaclari SUREC-ICI bellekte (REDIS_URL yok). Cok ornekli ' +
        'dagitimda sinir ornek sayisiyla carpilir.',
    );
    return undefined;
  }

  // Baglanti kurmayi burada BEKLEMEYIZ: ioredis tembel baglanir ve kopmada
  // kendi kendine yeniden dener. Acilisin Redis'e bagli olmasi, sayac deposu
  // ugruna tum uygulamayi baslamaz hale getirirdi.
  const storage = new ThrottlerStorageRedisService(redisUrl);
  storage.redis.on('error', (error: Error) => {
    // Sessiz kalmasi en kotusu olurdu: Redis dusunce `increment` hata verir,
    // ThrottlerGuard bunu yukari tasir ve istekler 500 alir. Log en azindan
    // nedeni gosterir.
    logger.error(`Redis baglanti hatasi: ${error.message}`);
  });
  logger.log(
    'Hiz siniri sayaclari REDIS uzerinde (ornekler arasi paylasimli).',
  );
  return storage;
}
