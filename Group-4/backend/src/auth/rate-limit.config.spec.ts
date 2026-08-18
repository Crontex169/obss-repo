import {
  RATE_LIMIT_MAX_ENTRIES,
  checkRateLimit,
  recordFailedAttempt,
  resetAttempts,
} from './rate-limit.config';

// docs/SECURITY.md S12 — sayaclarin sinirsiz buyumesi.
//
// Eskiden suresi dolmus kayit YALNIZCA ayni anahtar tekrar denendiginde
// siliniyordu; bir daha gorulmeyen anahtarlar sonsuza kadar kaliyordu.
describe('Siklik sinirlayici bellek siniri (S12)', () => {
  it('esik asilinca harita sinirli kalir', () => {
    // Esigin biraz ustune cikilir; her giris AYRI bir anahtar acar.
    const total = RATE_LIMIT_MAX_ENTRIES + 500;
    for (let i = 0; i < total; i += 1) {
      recordFailedAttempt(`s12-buyume-${i}@example.com`);
    }

    // Harita disariya acilmadigi icin dolayli olcum: en eski anahtarlarin
    // dusurulmus, en yenilerin durmus olmasi beklenir.
    // En yeni anahtar hala sayilmis olmali (kaydi duruyor).
    for (let i = 0; i < 11; i += 1) {
      recordFailedAttempt(`s12-yeni@example.com`);
    }
    expect(checkRateLimit('s12-yeni@example.com').blocked).toBe(true);
    resetAttempts('s12-yeni@example.com');

    // En eski anahtarlardan biri dusurulmus olmali: sayaci sifirlandigi icin
    // tek bir basarisiz denemeyle engellenmis duruma GELMEZ.
    expect(checkRateLimit('s12-buyume-0@example.com').blocked).toBe(false);
  });

  it('temizlik mesru sayaci bozmaz: esik altinda kayit korunur', () => {
    const email = 's12-korunan@example.com';
    resetAttempts(email);

    for (let i = 0; i < 10; i += 1) {
      recordFailedAttempt(email);
    }

    expect(checkRateLimit(email).blocked).toBe(true);
    resetAttempts(email);
    expect(checkRateLimit(email).blocked).toBe(false);
  });
});
