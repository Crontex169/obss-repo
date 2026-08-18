// DOSYA REHBERİ: Parola sıfırlama isteğinde yeni parolanın password-policy.ts
// kuralına uyup uymadığını, işlem gerçekleşmeden ÖNCE kontrol eder — uymuyorsa
// token harcanmadan reddedilir.
import { APIError } from 'better-auth/api';
import { passwordPolicy } from './password-policy';

// hooks.before('/reset-password'): FR-006 — yeni sifre, kayit akisiyla BIREBIR
// ayni politikaya tabidir (min 8 karakter + en az bir harf + en az bir rakam).
// Better Auth'un native kontrolu yalnizca karakter SAYISINA bakar, harf/rakam
// kombinasyonuna bakmaz (bkz. research.md Karar 2).
//
// Hook, uc noktasi calismadan once devreye girdigi icin ret durumunda token
// TUKETILMEZ; kullanici ayni baglantiyla tekrar deneyebilir (FR-006).
export function enforceResetPasswordPolicy(
  body: Record<string, unknown> | undefined,
): void {
  const newPassword = body?.newPassword as string | undefined;
  if (!newPassword) return;

  const result = passwordPolicy.safeParse(newPassword);
  if (!result.success) {
    throw new APIError('BAD_REQUEST', {
      message: result.error.issues[0]?.message ?? 'Geçersiz şifre',
      code: 'WEAK_PASSWORD',
    });
  }
}
