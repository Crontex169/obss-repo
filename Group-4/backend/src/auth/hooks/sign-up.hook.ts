// DOSYA REHBERİ: Kayıt isteğinde parola politikasını uygular ve aynı e-postayla
// zaten Google hesabı varsa parola ile tekrar kayıt olmayı engeller; ikisinde
// de saldırganın "bu e-posta kayıtlı mı" bilgisini çıkaramaması için aynı
// genel hata mesajı döner.
import { PrismaClient } from '@prisma/client';
import { APIError } from 'better-auth/api';
import { passwordPolicy } from './password-policy';

// hooks.before('/sign-up/email'): sifre politikasi (FR-002) + yalnizca-Google
// hesabina parola kaydi reddi (ACCOUNT_USE_GOOGLE, Hikaye 3 kriter 3) +
// mukerrer e-posta genel reddi (FR-003/FR-014, alan sizdirmaz).
export async function enforceSignUpPolicy(
  prisma: PrismaClient,
  body: Record<string, unknown> | undefined,
): Promise<void> {
  const email = body?.email as string | undefined;
  const password = body?.password as string | undefined;

  if (password) {
    const result = passwordPolicy.safeParse(password);
    if (!result.success) {
      throw new APIError('BAD_REQUEST', {
        message: result.error.issues[0]?.message ?? 'Geçersiz şifre',
        code: 'WEAK_PASSWORD',
      });
    }
  }

  if (!email) return;

  // docs/SECURITY.md S7 (yan bulgu): `include: { accounts: true }` hesap
  // satirlarinin TAMAMINI, parola hash'leri dahil bellege cekiyordu. Burada
  // gereken tek bilgi hangi saglayicilarin bagli oldugu; hash'i hic okumamak
  // onu sizdirabilecek her yolu (log, hata ayiklama ciktisi, gelecekteki bir
  // serialize) bastan kapatir.
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { accounts: { select: { providerId: true } } },
  });
  if (!existingUser) return;

  const hasCredential = existingUser.accounts.some(
    (a) => a.providerId === 'credential',
  );
  const hasGoogle = existingUser.accounts.some(
    (a) => a.providerId === 'google',
  );
  if (!hasCredential && hasGoogle) {
    throw new APIError('FORBIDDEN', {
      message: 'Bu e-posta Google ile kayıtlı. Lütfen Google ile giriş yapın.',
      code: 'ACCOUNT_USE_GOOGLE',
    });
  }
  throw new APIError('CONFLICT', {
    message: 'Kayıt tamamlanamadı',
    code: 'ACCOUNT_EXISTS',
  });
}
