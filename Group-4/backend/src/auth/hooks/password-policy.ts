// DOSYA REHBERİ: Parola kuralının TEK kaynağı — en az 8 karakter + en az bir
// harf + bir rakam. Hem kayıt hem parola sıfırlama akışı aynı bu şemayı
// kullanır, kural iki yerde ayrı ayrı yazılmaz.
import { z } from 'zod';
// en az bir harf + bir rakam. Kayit (sign-up.hook.ts) ve sifre sifirlama
// (reset-password.hook.ts) akislari AYNI semayi paylasir — iki yerde
// birbirinden kayabilecek iki kopya olmamasi icin burada tek kaynak.
export const passwordPolicy = z
  .string()
  .min(8, 'Şifre en az 8 karakter olmalıdır')
  .regex(/[a-zA-Z]/, 'Şifre en az bir harf içermelidir')
  .regex(/[0-9]/, 'Şifre en az bir rakam içermelidir');
