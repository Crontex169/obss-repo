import { validateEnv } from './env.validation';

// docs/SECURITY.md S1, S9, S11 — ortam dogrulamasinin guvenlik iddialari.
// Bu alanlar fail-fast zincirinin parcasidir: yanlis deger uygulamayi
// BASLATMAMALIDIR, sessizce guvensiz bir varsayilana dusmemelidir.
describe('validateEnv — guvenlik alanlari', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db?schema=public',
    BETTER_AUTH_SECRET: 'a'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:3000',
    FRONTEND_URL: 'http://localhost:5173',
    GOOGLE_CLIENT_ID: 'id',
    GOOGLE_CLIENT_SECRET: 'secret',
    ADMIN_EMAIL: 'admin@example.com',
    ADMIN_PASSWORD: 'Parola12',
    LLM_BASE_URL: 'https://api.groq.com/openai/v1',
    LLM_API_KEY: 'key',
    LLM_MODEL: 'openai/gpt-oss-120b',
  };

  describe('S9 — ADMIN_PASSWORD parola politikasina tabidir', () => {
    it('yalnizca harften olusan 8 karakter REDDEDILIR', () => {
      // Eskiden yalnizca min(8) araniyordu; "aaaaaaaa" gecerliydi.
      expect(() =>
        validateEnv({ ...base, ADMIN_PASSWORD: 'aaaaaaaa' }),
      ).toThrow(/ADMIN_PASSWORD/);
    });

    it('yalnizca rakamdan olusan 8 karakter REDDEDILIR', () => {
      expect(() =>
        validateEnv({ ...base, ADMIN_PASSWORD: '12345678' }),
      ).toThrow(/ADMIN_PASSWORD/);
    });

    it('8 karakterden kisa REDDEDILIR', () => {
      expect(() => validateEnv({ ...base, ADMIN_PASSWORD: 'Ab1' })).toThrow(
        /ADMIN_PASSWORD/,
      );
    });

    it('harf + rakam iceren 8+ karakter kabul edilir', () => {
      expect(validateEnv({ ...base, ADMIN_PASSWORD: 'Parola12' })).toBeTruthy();
    });
  });

  describe('S1 — ALLOW_TUNNEL_HOSTS varsayilani KAPALI', () => {
    it('tanimli degilse false doner', () => {
      expect(validateEnv({ ...base }).ALLOW_TUNNEL_HOSTS).toBe('false');
    });

    it('gecersiz deger sessizce kapaliya DUSMEZ, hata verir', () => {
      // "True" / "1" gibi yazim hatalari uretimde jokeri acik birakabilirdi.
      expect(() =>
        validateEnv({ ...base, ALLOW_TUNNEL_HOSTS: 'True' }),
      ).toThrow(/ALLOW_TUNNEL_HOSTS/);
    });
  });

  describe('S5/S11 — cerez ve vekil ayarlari', () => {
    it('COOKIE_SAMESITE varsayilani lax', () => {
      expect(validateEnv({ ...base }).COOKIE_SAMESITE).toBe('lax');
    });

    it('COOKIE_SAMESITE yalnizca lax/strict/none kabul eder', () => {
      expect(() => validateEnv({ ...base, COOKIE_SAMESITE: 'yok' })).toThrow(
        /COOKIE_SAMESITE/,
      );
    });

    it('TRUST_PROXY varsayilani 0 (kapali)', () => {
      expect(validateEnv({ ...base }).TRUST_PROXY).toBe(0);
    });

    it('TRUST_PROXY negatif olamaz', () => {
      expect(() => validateEnv({ ...base, TRUST_PROXY: '-1' })).toThrow(
        /TRUST_PROXY/,
      );
    });

    // S2: uretimde varsayilana dusmek sessiz bir arizadir — ters vekil
    // arkasinda IP kovasi tum kullanicilar icin tek kovaya doner.
    it('NODE_ENV=production iken TRUST_PROXY tanimsizsa REDDEDILIR', () => {
      expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow(
        /TRUST_PROXY/,
      );
    });

    it('uretimde acikca 0 yazmak gecerlidir (vekil yok karari)', () => {
      expect(
        validateEnv({ ...base, NODE_ENV: 'production', TRUST_PROXY: '0' })
          .TRUST_PROXY,
      ).toBe(0);
    });

    it('uretim disinda tanimsiz TRUST_PROXY hata vermez', () => {
      expect(validateEnv({ ...base, NODE_ENV: 'test' }).TRUST_PROXY).toBe(0);
    });
  });
});
