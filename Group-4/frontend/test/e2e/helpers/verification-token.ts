import { SignJWT } from 'jose'
import { BETTER_AUTH_SECRET } from './backend-env'

// S1: gercek e-posta gonderimi yok (MAIL_TRANSPORT=console, ADR-0008
// beklemede). Better Auth'un dogrulama linki, DB'de degil, secret ile
// imzalanmis kendi kendine yeten bir JWT'dir (bkz. better-auth/dist/crypto/jwt.mjs
// signJWT: HS256, {email}, setExpirationTime). Ayni imzayi burada uretip
// gercek /api/auth/verify-email ucuna gidiyoruz — boylece GERCEK dogrulama
// kodu calisiyor, yalnizca "e-posta teslimati" adimi atlaniyor.
export async function signVerificationToken(email: string): Promise<string> {
  return new SignJWT({ email: email.toLowerCase() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(new TextEncoder().encode(BETTER_AUTH_SECRET))
}
