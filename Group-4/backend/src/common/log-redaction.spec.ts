import { redactEmail } from './log-redaction';

// docs/SECURITY.md S8 — guvenlik olayi loglari kisisel veri tasimamali.
describe('redactEmail', () => {
  const ORIGINAL = process.env.BETTER_AUTH_SECRET;

  beforeAll(() => {
    process.env.BETTER_AUTH_SECRET = 'test-secret-en-az-32-karakter-olmali!!';
  });

  afterAll(() => {
    process.env.BETTER_AUTH_SECRET = ORIGINAL;
  });

  it('cikti duz e-postayi TASIMAZ', () => {
    const out = redactEmail('kullanici@example.com');
    expect(out).not.toContain('kullanici');
    expect(out).not.toContain('example.com');
    expect(out).not.toContain('@');
  });

  it('ayni e-posta ayni etiketi uretir (korelasyon korunur)', () => {
    expect(redactEmail('a@example.com')).toBe(redactEmail('a@example.com'));
  });

  it('buyuk/kucuk harf farki ayni etikete duser', () => {
    expect(redactEmail('A@Example.COM')).toBe(redactEmail('a@example.com'));
  });

  it('farkli e-postalar farkli etiket uretir', () => {
    expect(redactEmail('a@example.com')).not.toBe(redactEmail('b@example.com'));
  });

  it('anahtar degisirse etiket degisir (HMAC, duz ozet degil)', () => {
    const withFirstKey = redactEmail('a@example.com');
    process.env.BETTER_AUTH_SECRET = 'baska-bir-sir-en-az-32-karakter-olmali!';
    const withSecondKey = redactEmail('a@example.com');
    process.env.BETTER_AUTH_SECRET = 'test-secret-en-az-32-karakter-olmali!!';

    // Anahtarsiz SHA-256 olsaydi ikisi ayni cikardi ve e-posta sozlugu ile
    // geri cozulebilirdi.
    expect(withFirstKey).not.toBe(withSecondKey);
  });
});
