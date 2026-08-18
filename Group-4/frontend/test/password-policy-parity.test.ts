import { describe, it, expect } from 'vitest';
import { passwordSchema } from '@/lib/validation';
// Sunucu tarafi tek kaynak (sign-up.hook.ts ve reset-password.hook.ts bunu kullanir).
import { passwordPolicy } from '../../backend/src/auth/hooks/password-policy';

// I1' / FR-002: istemci (UX) ve sunucu (zorunlu) sifre politikasi birebir ayni
// olmali. Ayrisirlarsa kullanici formda gecen bir sifreyle 400 alir (ya da tersi).
const cases = [
  'Parola12', // gecerli
  'Parola123456789', // gecerli, uzun
  'P4rol', // kisa
  '', // bos
  '1234567', // kisa + harfsiz
  '12345678', // harfsiz
  'Parolaaa', // rakamsiz
  'parola12', // gecerli, kucuk harf
  'PAROLA12', // gecerli, buyuk harf
  'parola 12', // gecerli, bosluklu
  'şifre123', // gecerli olmayan: harf regexi ASCII [a-zA-Z] ister
  '        ', // yalnizca bosluk
];

describe('sifre politikasi istemci/sunucu esitligi (FR-002)', () => {
  it.each(cases)('"%s" iki tarafta ayni sonucu verir', (password) => {
    expect(passwordSchema.safeParse(password).success).toBe(
      passwordPolicy.safeParse(password).success,
    );
  });

  it('kontrol grubu: vaka kumesi hem gecerli hem gecersiz ornek icerir', () => {
    const results = cases.map((c) => passwordPolicy.safeParse(c).success);
    expect(results).toContain(true);
    expect(results).toContain(false);
  });
});
