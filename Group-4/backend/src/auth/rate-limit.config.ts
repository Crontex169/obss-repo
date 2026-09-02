// DOSYA REHBERİ: E-posta/kullanıcı bazlı tüm hız sınırlama sayaçlarının
// (başarısız giriş denemesi, parola sıfırlama isteği, hesap silme denemesi)
// bellek içi (in-memory) mantığını tutar; sayaçların sınırsız büyümesini
// önleyen bir "budama" mekanizması da içerir.
// FR-017: Ayni e-posta icin 10 basarisiz giris denemesinden sonra throttling
// (artan gecikme / basit sayac). Sabit sureli TAM KILIT uygulanmaz — pencere
// suresi gectikce veya basarili girisle sayac sifirlanir.
//
// Karar (kullanici onayi, 2026-07-30): Better Auth'un yerlesik `rateLimit`
// mekanizmasi varsayilan olarak IP+path bazlidir; e-posta alanina gore
// anahtarlama yerlesik desteklenmedigi icin Better Auth'un `hooks.before`/
// `hooks.after` genisleme noktalari kullanilarak e-posta bazli ozel bir sayac
// burada uygulanir (bkz. better-auth.config.ts). Gercek CAPTCHA ENTEGRE
// EDILMEMISTIR (kapsam disi) — yalnizca sayac + artan gecikme.

/**
 * E-posta/kullanıcı bazlı tüm hız sınırlama sayaçlarının (başarısız giriş denemesi, parola sıfırlama isteği,
 * hesap silme denemesi) bellek içi (in-memory) mantığını tutar; sayaçların sınırsız büyümesini önleyen bir "budama" mekanizması da içerir.
 */

interface AttemptRecord {
  failureCount: number;
  windowStart: number;
  blockedUntil: number;
}

const WINDOW_MS = 15 * 60 * 1000; // 15 dakikalik pencere
export const FAILURE_THRESHOLD = 10; // 10 basarisiz denemeden SONRAKI istek engellenir
const BASE_BACKOFF_MS = 2_000; // artan gecikme taban degeri
const MAX_BACKOFF_MS = 5 * 60 * 1000; // ust sinir (5 dk) — tam kilit degil

const attempts = new Map<string, AttemptRecord>();
// ponytail: surec-ici Map — cok-ornekli (multi-instance) dagitimda her
// process kendi sayacini tutar (paylasilmaz) ve restart'ta sifirlanir.
// Tek-instance gelistirme/kucuk-olcek icin yeterli; olcek gerekirse Redis
// (TTL destekli) ile degistir (bkz. docs/API_CONVENTIONS.md).
// Sinirsiz buyume ARTIK YOK — asagidaki pruneIfNeeded'a bak (SECURITY.md S12).

// ---------------------------------------------------------------------------
// docs/SECURITY.md S12 — sayaclarin sinirsiz buyumesi.
//
// Suresi dolmus kayit eskiden YALNIZCA ayni anahtar tekrar denendiginde
// siliniyordu; bir daha hic gorulmeyen anahtarlarin kaydi sonsuza kadar
// kaliyordu. Rastgele e-postalarla istek uretilerek bellek sisirilebilirdi.
//
// COZUM: zamanlayici YOK. setInterval sureci ayakta tutar, testlerde acik
// handle birakir ve modulun bir yasam dongusu olmasini gerektirirdi. Yerine
// yazma sirasinda tembel temizlik: harita bir esigi asinca once suresi
// dolmuslar atilir, hala buyukse en eski kayitlar dusurulur.
//
// En eskiyi dusurmek GUVENLI yondedir: dusurulen kayit yalnizca bir sayactir,
// silinmesi o anahtarin sifirdan baslamasi demektir. Kotu senaryoda saldirgan
// kendi sayacini sifirlatir — ama bunun icin zaten haritayi tasiracak kadar
// istek uretmesi gerekir ki o hacim global siklik sinirina (app.module.ts
// `default` kovasi) ve e-posta bazli esiklere carpar.
// ---------------------------------------------------------------------------

const MAX_ENTRIES = 10_000;
// Temizlik, haritayi esige DEGIL bu alt isarete kadar indirir (histerezis).
//
// NEDEN: tam esige indirseydik, harita esikte takildiginda SONRAKI HER ekleme
// yeniden tam tarama (+ gerekirse sıralama) tetiklerdi — yani sicak yolda
// kalici O(n) maliyet. Alt isaret sayesinde temizlik ancak araya 2.000 yeni
// kayit girdikten sonra tekrar calisir; amortize maliyet ekleme basina sabite
// yaklasir.
const PRUNE_TARGET = 8_000;

function pruneIfNeeded<T extends { windowStart: number }>(
  map: Map<string, T>,
  windowMs: number,
): void {
  if (map.size <= MAX_ENTRIES) return;

  const now = Date.now();
  for (const [key, record] of map) {
    if (now - record.windowStart > windowMs) map.delete(key);
  }

  if (map.size <= PRUNE_TARGET) return;

  // Hala doluysa: en eski pencereye sahip kayitlari alt isarete kadar dusur.
  const byAge = [...map.entries()].sort(
    (a, b) => a[1].windowStart - b[1].windowStart,
  );
  for (const [key] of byAge.slice(0, map.size - PRUNE_TARGET)) {
    map.delete(key);
  }
}

// Test icin: esigi disaridan gorunur kilar (uretim akisinda kullanilmaz).
export const RATE_LIMIT_MAX_ENTRIES = MAX_ENTRIES;

function backoffMs(excess: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** excess, MAX_BACKOFF_MS);
}

export function checkRateLimit(email: string): {
  blocked: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const record = attempts.get(email.toLowerCase());
  if (!record) return { blocked: false, retryAfterSeconds: 0 };

  if (now - record.windowStart > WINDOW_MS) {
    attempts.delete(email.toLowerCase());
    return { blocked: false, retryAfterSeconds: 0 };
  }

  if (record.failureCount >= FAILURE_THRESHOLD && now < record.blockedUntil) {
    return {
      blocked: true,
      retryAfterSeconds: Math.ceil((record.blockedUntil - now) / 1000),
    };
  }

  return { blocked: false, retryAfterSeconds: 0 };
}

export function recordFailedAttempt(email: string): void {
  const key = email.toLowerCase();
  const now = Date.now();
  const record = attempts.get(key);

  if (!record || now - record.windowStart > WINDOW_MS) {
    attempts.set(key, { failureCount: 1, windowStart: now, blockedUntil: 0 });
    pruneIfNeeded(attempts, WINDOW_MS); // S12
    return;
  }

  record.failureCount += 1;
  if (record.failureCount >= FAILURE_THRESHOLD) {
    const excess = record.failureCount - FAILURE_THRESHOLD;
    record.blockedUntil = now + backoffMs(excess);
  }
}

export function resetAttempts(email: string): void {
  attempts.delete(email.toLowerCase());
}

/**
 * Bir /sign-in/email yanitinin HTTP durumundan sayac eylemini turetir.
 * Kural better-auth.config.ts'in `after` kancasinda GOMULU DEGIL burada
 * durur ki tek basina test edilebilsin — yanlis durum kumesini saymak bu
 * mekanizmanin en sessiz ariza bicimidir.
 *
 *   'fail'   -> gercek bir kimlik tahmini basarisiz oldu (401: yanlis sifre
 *               veya kayitli olmayan e-posta; Better Auth ikisine de ayni
 *               genel 401'i doner). Yalnizca bu sayaci artirir.
 *   'reset'  -> giris basarili; sayac temizlenir.
 *   'ignore' -> 401 DISINDAKI hatalar. Onemli ornek: e-postasi henuz
 *               dogrulanmamis kullanici DOGRU sifreyle 403 EMAIL_NOT_VERIFIED
 *               alir. Bunu "basarisiz deneme" saymak kullanicinin kendi
 *               hesabini 10 denemede kilitlemesine yol aciyordu — orada tahmin
 *               edilen bir sey yok. Sifirlamamak da bilincli: sifirlasaydik
 *               dogrulanmamis hesap gercek denemeleri temizleyen bir baypas
 *               kapisi olurdu (429 ve 5xx icin de ayni gerekce).
 */
export function signInAttemptOutcome(
  status: number,
): 'fail' | 'reset' | 'ignore' {
  if (status === 401) return 'fail';
  if (status < 400) return 'reset';
  return 'ignore';
}

// ---------------------------------------------------------------------------
// FR-007 (006-sifre-sifirlama): sifre sifirlama ISTEGI icin ayri sayac.
// Giris-denemesi sayacindan (yukarisi) bilincli olarak AYRI tutulur: farkli
// islem (istek baslatma vs. basarisiz giris), farkli esik/pencere (saatte 3
// vs. 15 dk'da 10) ve farkli davranis (sabit esik, artan gecikme yok).
// Ayni Map'i paylasmak iki guvenlik politikasini birbirine karistirirdi
// (bkz. research.md Karar 5).
// ---------------------------------------------------------------------------

interface ResetRequestRecord {
  count: number;
  windowStart: number;
}

const RESET_WINDOW_MS = 60 * 60 * 1000; // 1 saatlik pencere
export const RESET_REQUEST_THRESHOLD = 3; // saatte 3 istek; 4. istek engellenir

const resetRequests = new Map<string, ResetRequestRecord>();

export function checkResetRequestRateLimit(email: string): {
  blocked: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const key = email.toLowerCase();
  const record = resetRequests.get(key);
  if (!record) return { blocked: false, retryAfterSeconds: 0 };

  if (now - record.windowStart > RESET_WINDOW_MS) {
    resetRequests.delete(key);
    return { blocked: false, retryAfterSeconds: 0 };
  }

  if (record.count >= RESET_REQUEST_THRESHOLD) {
    return {
      blocked: true,
      retryAfterSeconds: Math.ceil(
        (record.windowStart + RESET_WINDOW_MS - now) / 1000,
      ),
    };
  }

  return { blocked: false, retryAfterSeconds: 0 };
}

export function recordResetRequest(email: string): void {
  const key = email.toLowerCase();
  const now = Date.now();
  const record = resetRequests.get(key);

  if (!record || now - record.windowStart > RESET_WINDOW_MS) {
    resetRequests.set(key, { count: 1, windowStart: now });
    pruneIfNeeded(resetRequests, RESET_WINDOW_MS); // S12
    return;
  }
  record.count += 1;
}

// ---------------------------------------------------------------------------
// docs/SECURITY.md S2: DELETE /api/users/me parola dogrulamasi yapar ve yaniti
// ayirt edilebilirdir (yanlis sifre 401, dogru sifre 204). Sinir olmadan bu uc
// nokta, ele gecirilmis bir oturum cerezinde SINIRSIZ parola tahmin oracle'ina
// donusur - ustelik dogru tahminin bedeli geri alinamaz hesap silmedir.
//
// Yukaridaki iki sayactan AYRI tutulur: farkli kimlik (userId, e-posta degil -
// hedef zaten oturumdan gelir), farkli esik ve farkli davranis. Ayni Map'i
// paylasmak uc ayri guvenlik politikasini birbirine karistirirdi.
//
// Sayac YALNIZCA basarisiz denemede artar; basarili silmede kayit zaten
// kullaniciyla birlikte anlamsizlasir.
// ---------------------------------------------------------------------------

interface DeleteAttemptRecord {
  count: number;
  windowStart: number;
}

const DELETE_WINDOW_MS = 60 * 60 * 1000; // 1 saatlik pencere
export const ACCOUNT_DELETE_THRESHOLD = 5; // saatte 5 basarisiz deneme; 6. engellenir

const deleteAttempts = new Map<string, DeleteAttemptRecord>();

export function checkAccountDeleteRateLimit(userId: string): {
  blocked: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const record = deleteAttempts.get(userId);
  if (!record) return { blocked: false, retryAfterSeconds: 0 };

  if (now - record.windowStart > DELETE_WINDOW_MS) {
    deleteAttempts.delete(userId);
    return { blocked: false, retryAfterSeconds: 0 };
  }

  if (record.count >= ACCOUNT_DELETE_THRESHOLD) {
    return {
      blocked: true,
      retryAfterSeconds: Math.ceil(
        (record.windowStart + DELETE_WINDOW_MS - now) / 1000,
      ),
    };
  }

  return { blocked: false, retryAfterSeconds: 0 };
}

export function recordFailedAccountDeleteAttempt(userId: string): void {
  const now = Date.now();
  const record = deleteAttempts.get(userId);

  if (!record || now - record.windowStart > DELETE_WINDOW_MS) {
    deleteAttempts.set(userId, { count: 1, windowStart: now });
    pruneIfNeeded(deleteAttempts, DELETE_WINDOW_MS); // S12
    return;
  }
  record.count += 1;
}
