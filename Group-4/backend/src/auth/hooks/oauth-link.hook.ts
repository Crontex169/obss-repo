// DOSYA REHBERİ: "Admin hesabı Google ile giriş yapamaz" kuralını üç farklı
// Google giriş yolunda (id-token, One Tap, tarayıcı yönlendirmesi) ayrı ayrı
// uygulayan üç fonksiyon içerir — çünkü her yolun istek gövdesi farklı
// şekilde geliyor.
import { decodeJwt } from 'jose';
import { PrismaClient } from '@prisma/client';
import { APIError } from 'better-auth/api';

//"Admin hesabı Google ile giriş yapamaz" kuralını üç farklı Google giriş yolunda (id-token, One Tap, tarayıcı yönlendirmesi) ayrı ayrı uygulayan üç fonksiyon içerir 
// — çünkü her yolun istek gövdesi farklı şekilde geliyor.

// Hikaye 3 kriter 4 / FR-006: admin hesabina Google ile oturum acilmaz.
// idToken akisinda (POST /sign-in/social) e-posta, Better Auth kendi
// dogrulamasini yapmadan ONCE burada (imza dogrulanmadan, yalniz rol
// on-kontrolu icin) okunur; admin ise istek Better Auth hicbir sey
// olusturmadan (session/account) FORBIDDEN ile reddedilir.
export async function rejectAdminGoogleIdTokenSignIn(
  prisma: PrismaClient,
  body: Record<string, unknown> | undefined,
): Promise<void> {
  if (body?.provider !== 'google') return;
  const idToken = (body?.idToken as { token?: string } | undefined)?.token;
  if (!idToken) return;

  let email: string | undefined;
  try {
    email = decodeJwt(idToken).email as string | undefined;
  } catch {
    return; // gecersiz token: gercek dogrulama Better Auth'ta yapilacak
  }
  if (!email) return;

  const user = await prisma.user.findUnique({ where: { email } });
  if (user?.role === 'admin') {
    throw new APIError('FORBIDDEN', {
      message: 'Admin hesabi Google ile giris yapamaz. E-posta/sifre kullanin.',
      code: 'ADMIN_GOOGLE_FORBIDDEN',
    });
  }
}

// Google One Tap (/one-tap/callback) ayni FR-006 riskini tasir: govde
// {idToken: string} sekilli (sosyal girisin ic ice {idToken:{token}} sekli
// DEGIL), bu yuzden yukaridaki fonksiyon tekrar kullanilamaz - ayni on-kontrol
// burada tekrarlanir.
export async function rejectAdminGoogleOneTapSignIn(
  prisma: PrismaClient,
  body: Record<string, unknown> | undefined,
): Promise<void> {
  const idToken = body?.idToken as string | undefined;
  if (!idToken) return;

  let email: string | undefined;
  try {
    email = decodeJwt(idToken).email as string | undefined;
  } catch {
    return; // gecersiz token: gercek dogrulama Better Auth'ta yapilacak
  }
  if (!email) return;

  const user = await prisma.user.findUnique({ where: { email } });
  if (user?.role === 'admin') {
    throw new APIError('FORBIDDEN', {
      message: 'Admin hesabi Google ile giris yapamaz. E-posta/sifre kullanin.',
      code: 'ADMIN_GOOGLE_FORBIDDEN',
    });
  }
}

// Guvenlik agi: yonlendirme/callback akisinda (tarayici) e-posta hooks.before
// asamasinda henuz bilinmez (Google'in kod degisimi endpoint icinde olur).
// Bu yuzden oturum DB'ye yazilmadan hemen once (databaseHooks.session.create.before)
// hedef kullanicinin rolu kontrol edilir; admin ise oturum olusturulmaz.
export async function rejectAdminGoogleSession(
  prisma: PrismaClient,
  session: { userId: string },
  context: { path?: string; body?: Record<string, unknown> } | null,
): Promise<boolean> {
  const isGoogleCallback = context?.path === '/callback/google';
  const isGoogleIdTokenSignIn =
    context?.path === '/sign-in/social' && context.body?.provider === 'google';
  const isGoogleOneTap = context?.path === '/one-tap/callback';
  if (!isGoogleCallback && !isGoogleIdTokenSignIn && !isGoogleOneTap)
    return true;

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  return user?.role !== 'admin';
}
