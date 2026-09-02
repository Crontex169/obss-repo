// DOSYA REHBERİ: Auth tarafının en kalın dosyası — Better Auth kütüphanesinin
// tüm ayarlarını tek yerde toplar: parola kuralları, e-posta doğrulama süresi,
// çerez güvenliği (sameSite/secure), Google OAuth, admin+Google girişinin
// engellenmesi, oturum süresi (30 gün) ve giriş/kayıt/parola sıfırlama
// akışlarına takılan güvenlik kancaları (hooks.before/after). Rol bilgisinin
// istemciden asla gönderilemeyeceği garantisi (input: false) de burada verilir.
import 'dotenv/config';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { oneTap } from 'better-auth/plugins';
import { PrismaClient } from '@prisma/client';
import {
  sendVerificationEmail as sendVerificationEmailImpl,
  sendPasswordResetEmail,
  sendGoogleOnlyResetNoticeEmail,
} from './mail/verification-mailer';
import {
  checkRateLimit,
  recordFailedAttempt,
  resetAttempts,
  checkResetRequestRateLimit,
  recordResetRequest,
  signInAttemptOutcome,
} from './rate-limit.config';
import {
  rejectAdminGoogleIdTokenSignIn,
  rejectAdminGoogleOneTapSignIn,
  rejectAdminGoogleSession,
} from './hooks/oauth-link.hook';
import { enforceSignUpPolicy } from './hooks/sign-up.hook';
import { enforceResetPasswordPolicy } from './hooks/reset-password.hook';
import { redactEmail } from '../common/log-redaction';

/**
 *
 *
 * Auth tarafının en kalın dosyası —
 * Better Auth kütüphanesinin tüm ayarlarını tek yerde toplar: parola kuralları, e-posta doğrulama süresi, çerez güvenliği ( sameSite / secure ),
 * Google OAuth, admin+Google girişinin engellenmesi, oturum süresi (30 gün) ve giriş/kayıt/parola sıfırlama akışlarına takılan güvenlik kancaları ( hooks.before / after ).
 *  Rol bilgisinin istemciden asla gönderilemeyeceği garantisi ( input: false ) de burada verilir.
 */

// better-auth `ctx.body`'yi `any` olarak tipler. E-posta okumayi TEK bir
// dogrulanmis yardimciya topluyoruz: hem lint'in unsafe-member-access uyarisi
// kaynaginda cozulur, hem de "email string degilse yok say" kurali uc cagri
// yerinde tekrarlanmak yerine burada bir kez ifade edilir.
function readEmail(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const value = (body as { email?: unknown }).email;
  return typeof value === 'string' ? value : undefined;
}

// Better Auth cekirdek yapilandirmasi.
// - Prisma adaptoru: user/session/account/verification tablolarini yonetir.
// - emailAndPassword: sifre politikasi FR-002 (hooks.before ile zorunlu kilinir).
// - requireEmailVerification: dogrulanmadan sign-in -> 403 EMAIL_NOT_VERIFIED (FR-019).
// prisma parametresi NestJS PrismaService'ten gelir; global new PrismaClient() olusturulmaz.
export function createAuth(prisma: PrismaClient) {
  const localBaseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';
  const frontendURL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

  // Cloudflare quick tunnel destegi YALNIZCA ALLOW_TUNNEL_HOSTS=true iken acilir
  // (docs/SECURITY.md S1). Acikken Host `*.trycloudflare.com` ise baseURL istekten
  // cozulur — rastgele tunel adresi her acilista degistigi icin .env duzenlemeden
  // ve restart olmadan calisir; eslesmezse localBaseURL'e duser. allowedHosts
  // ayrica trustedOrigins'e de otomatik eklenir, bu yuzden tunel origin'i
  // "invalid origin" yemez.
  //
  // NEDEN VARSAYILAN KAPALI: joker host uretimde hesap ele gecirmeye aciktir.
  // Saldirgan kendi `*.trycloudflare.com` tunelini acar, Host basligini o adrese
  // ayarlayip /request-password-reset cagirirsa Better Auth baseURL'i saldirganin
  // origin'inden kurar; KURBANIN posta kutusuna saldirganin alan adina giden bir
  // sifirlama baglantisi gider ve kurban tikladiginda tek kullanimlik token sizar.
  // Ayni yol e-posta dogrulama baglantisi icin de gecerlidir.
  const tunnelHostsAllowed = process.env.ALLOW_TUNNEL_HOSTS === 'true';

  // docs/SECURITY.md S5: cerez duruşu ACIKCA yapilandirilir, Better Auth
  // varsayilanina birakilmaz. Onceden koruma tek bir ortuk varsayilana
  // (sameSite=lax) yasliydi: kodda hicbir dayanagi, dokumanda hicbir kaydi
  // yoktu ve ayri alan adina deploy icin `none`a cevrildigi an ozel NestJS
  // uclari CSRF'e acilirdi. Artik deger yapilandirmadan gelir ve OriginGuard
  // (common/guards/origin.guard.ts) duruştan BAGIMSIZ ikinci katmani saglar.
  const sameSite = (process.env.COOKIE_SAMESITE ?? 'lax') as
    'lax' | 'strict' | 'none';
  // sameSite='none' tarayicilar tarafindan YALNIZCA Secure cerezde kabul edilir;
  // aksi halde cerez sessizce dusurulur ve oturum hic kurulmaz. Bu yuzden secure
  // orada zorunludur, disinda uretim olcutune baglidir (local/test HTTP'dir).
  const secureCookie =
    sameSite === 'none' || process.env.NODE_ENV === 'production';

  return betterAuth({
    database: prismaAdapter(prisma, {
      provider: 'postgresql',
    }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: tunnelHostsAllowed
      ? {
          allowedHosts: ['*.trycloudflare.com'],
          protocol: 'auto',
          fallback: localBaseURL,
        }
      : localBaseURL,
    advanced: {
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite,
        secure: secureCookie,
      },
    },
    trustedOrigins: [frontendURL],
    // docs/SECURITY.md S7 — kabul edilmis riskin azaltmasi.
    //
    // Kayit akisi UC ayirt edilebilir yanit uretir: 409 ACCOUNT_EXISTS,
    // 403 ACCOUNT_USE_GOOGLE, basari. Yani hem hesabin varligi hem HANGI
    // saglayiciyla kayitli oldugu ogrenilebilir. Bu davranis bilincli bir
    // urun kararidir (specs/001-auth-rol/spec.md Hikaye 3 kriter 3; ayni
    // dosyada FR-014/SC-007 ile siniri netlestiren aciklama; sozlesme
    // contracts/auth-api.md) ve DS-03-E1 kabul kriteri olarak korunur —
    // GIRIS yolu zaten enumeration-safe'tir, sizinti yalnizca KAYIT yolundadir.
    //
    // Kaldirmak yerine PAHALILASTIRILIR: IP basina saatte 40 kayit denemesi,
    // tekil kullanicinin gorecegi bir sinir degil ama adres listesi tarayan
    // biri icin kutle sorgulamayi bitirir. Hedefli tekil sorgu hala mumkundur;
    // bu, SECURITY.md'de kabul edilmis risk olarak kayitlidir.
    //
    // Better Auth'un YERLESIK rateLimit'i tam olarak bu is icin uygundur
    // (IP + path bazli). rate-limit.config.ts'teki elle yazilmis sayaclar,
    // E-POSTA bazli anahtarlama yerlesik desteklenmedigi icin vardir —
    // burada istenen zaten IP bazli olandir, ikinci bir mekanizma gerekmez.
    //
    // `enabled` BILINCLI olarak verilmez: Better Auth varsayilani "yalnizca
    // production" demektir. Testler ve yerel gelistirme ayni IP'den yuzlerce
    // kayit yapar; sinirin orada acik olmasi gelistirmeyi kirardi, guvenlik
    // degeri ise yalnizca uretimde anlamlidir.
    rateLimit: {
      customRules: {
        '/sign-up/email': { window: 3600, max: 40 },
      },
    },
    // OAuth state'i (CSRF korumasi) `verification` tablosunda 10 dakika yasar.
    // Kullanici Google onay ekraninda oyalanir, geri/yenile ile ayni callback'i
    // TEKRAR acar ya da eski bir baglantiyi tiklarsa satir yoktur ve better-auth
    // "State mismatch: verification not found" atar. O anda istegin nereye
    // donecegi de (errorCallbackURL) ayni kayip satirda oldugu icin better-auth
    // KENDI ham hata sayfasina (`<backend>/api/auth/error`) yonlendiriyordu —
    // kullanicinin gordugu buydu. Burasi o durumda inilecek adresi verir.
    // Parametre EKLENMEZ: better-auth adresin sonuna kendi `?error=<kod>`unu
    // ekler (orn. `state_mismatch`); biz de eklersek iki tane `error` olur.
    // /login sayfasi `error` parametresini gorunce anlamli mesaji gosterir.
    //
    // Statik bir adres olmak zorunda: hata aninda state satiri yok, dolayisiyle
    // istegin geldigi origin'e gore per-request cozulemez. Tunel kullanan biri
    // bu yuzden FRONTEND_URL'e duser - tunelde calisirken .env'deki FRONTEND_URL
    // de tunel adresi olmali.
    onAPIError: {
      errorURL: `${frontendURL}/login`,
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true, // FR-019
      minPasswordLength: 8,
      // 006-sifre-sifirlama FR-010: token 1 saat gecerli.
      resetPasswordTokenExpiresIn: 3600,
      // FR-008: sifre sifirlandiktan hemen sonra kullanicinin TUM oturumlari silinir.
      revokeSessionsOnPasswordReset: true,
      // 006-sifre-sifirlama FR-003 (research.md Karar 3): bu callback YALNIZCA
      // gercekten var olan bir kullanici icin cagrilir (Better Auth kayitsiz
      // e-postada callback'i hic cagirmadan ayni genel 200'u doner - FR-002).
      // Burada yalnizca "hangi mail gidecek" ayrimi yapilir; yanit degismez.
      sendResetPassword: async ({ user, url, token }) => {
        const accounts = await prisma.account.findMany({
          where: { userId: user.id },
          select: { providerId: true },
        });
        const hasCredential = accounts.some(
          (a) => a.providerId === 'credential',
        );
        const hasGoogle = accounts.some((a) => a.providerId === 'google');

        // FR-011: yalnizca en guncel token gecerli olmali. Better Auth eski
        // kayitlari temizlemiyor, bu yuzden yeni token haric hepsi silinir.
        await prisma.verification.deleteMany({
          where: {
            value: user.id,
            identifier: { startsWith: 'reset-password:' },
            NOT: { identifier: `reset-password:${token}` },
          },
        });

        if (hasCredential) {
          await sendPasswordResetEmail(user.email, url);
          // FR-012: sessiz basarisizlik yasak - guvenlik olayi kayit altina alinir.
          // Kimlik duz e-posta DEGIL, kullanici id'sidir (docs/SECURITY.md S8).
          console.log(`[reset] Sifirlama baglantisi gonderildi: ${user.id}`);
          return;
        }

        if (hasGoogle) {
          // Parola hesabi yok: sifirlanacak sifre de yok. Kullaniciya dogru
          // yonlendirme yalnizca kendi posta kutusunda verilir (FR-002 korunur).
          await sendGoogleOnlyResetNoticeEmail(user.email);
          console.log(
            `[reset] Yalnizca-Google hesap bilgilendirmesi gonderildi: ${user.id}`,
          );
          return;
        }

        console.warn(
          `[reset] Hesabin kimlik saglayicisi yok, mail gonderilmedi: ${user.id}`,
        );
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      // 009: Better Auth varsayilani 3600 sn (1 saat) — kayit dogrulama linki
      // icin fazla agresif. Kullanici maili o saat icinde gormezse hesabi
      // kilitleniyordu. 24 saat, sifre sifirlamanin 1 saatinden AYRI bilincli
      // bir karardir: sifirlama linki ele gecerse hesabi devralir (yuksek
      // risk), dogrulama linki yalnizca zaten kullanicinin kendi adresine
      // gonderilmis bir onaydir (dusuk risk). Suresi yine de dolarsa
      // frontend'de "tekrar gonder" telafisi var (resend-verification.tsx).
      expiresIn: 86_400,
      // Not: `sendOnSignIn` (her basarisiz girisde otomatik yeniden gonderim)
      // BILINCLI OLARAK kapali — herhangi bir adrese sinirsiz mail gonderten
      // bir tetige donusurdu. Yerine kullanicinin acikca bastigi, Better Auth'un
      // yerlesik kuraliyla (3 istek / 60 sn, IP basina) sinirlanan buton var.
      // Better Auth'un kendi `url`'u backend'in sunucu-tarafi verify+redirect ucuna gider
      // (frontend'de karsilik yok). Frontend `verify-email.tsx` (T027) token'i kendi
      // sayfasinda okuyup `authClient.verifyEmail` ile dogruluyor - bu yuzden mail linki
      // dogrudan frontend sayfasina, `token` ile kurulur.
      sendVerificationEmail: async ({ user, token, url }) => {
        // Dinamik baseURL: `url`in origin'i istegin geldigi host'tur. Tunelde
        // frontend ayni origin'de yayinlandigi icin dogrudan kullanilir; local'de
        // fallback backend portunu doner, frontend ayri portta oldugundan
        // FRONTEND_URL'e donulur.
        const origin = new URL(url).origin;
        const frontendUrl =
          origin === new URL(localBaseURL).origin
            ? (process.env.FRONTEND_URL ?? 'http://localhost:5173')
            : origin;
        await sendVerificationEmailImpl(
          user.email,
          `${frontendUrl}/verify-email?token=${token}`,
        );
      },
    },
    user: {
      additionalFields: {
        role: {
          type: 'string',
          defaultValue: 'user',
          input: false, // istemci role gonderemez (guvenlik, Ilke V)
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 gun ust siniri; "Beni hatirla" olmadan session-scoped (US6, T058)
      // FR-013 (bulgu A2): "ayri bir idle timeout YOK" -> MUTLAK sure, aktivite
      // uzatmaz. updateAge:0 YANLIS coz umu olurdu (Better Auth'ta "her
      // kullanimda yenile" anlamina gelir) — dogrusu disableSessionRefresh.
      disableSessionRefresh: true,
    },
    // Hikaye 3 (Google ile giris): trustedProviders=['google'] + varsayilan
    // requireLocalEmailVerified sayesinde Better Auth once-parola-sonra-Google
    // (ayni e-posta) durumunu otomatik ayni hesaba baglar (kriter 2,4).
    // Ters yon (once Google, sonra parola) hooks.before /sign-up/email'de
    // reddedilir (ACCOUNT_USE_GOOGLE, T024).
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ['google'],
      },
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      },
    },
    // Google One Tap: socialProviders.google.clientId zaten tanimliysa plugin
    // ayrica bir clientId istemez. FR-006 (admin+Google reddi) bu akis icin de
    // gecerlidir - bkz. hooks.before '/one-tap/callback' ve
    // rejectAdminGoogleSession'daki isGoogleOneTap kontrolu.
    plugins: [oneTap()],
    databaseHooks: {
      session: {
        create: {
          // FR-006: admin + Google -> oturum DB'ye yazilmadan reddedilir.
          before: (session, context) =>
            rejectAdminGoogleSession(prisma, session, context),
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/sign-up/email') {
          await enforceSignUpPolicy(
            prisma,
            ctx.body as Record<string, unknown>,
          );
        }

        if (ctx.path === '/sign-in/social') {
          await rejectAdminGoogleIdTokenSignIn(
            prisma,
            ctx.body as Record<string, unknown>,
          );
        }

        if (ctx.path === '/one-tap/callback') {
          await rejectAdminGoogleOneTapSignIn(
            prisma,
            ctx.body as Record<string, unknown>,
          );
        }

        if (ctx.path === '/reset-password') {
          // FR-006: politika ihlali token TUKETILMEDEN reddedilir.
          enforceResetPasswordPolicy(ctx.body as Record<string, unknown>);
        }

        if (ctx.path === '/request-password-reset') {
          // 006-sifre-sifirlama FR-007: e-posta basina saatte 3 istek.
          // Sayac, e-postanin kayitli olup olmadigina BAKMADAN isletilir -
          // aksi halde 429/200 farki enumeration sizintisi olurdu (FR-002).
          const email = readEmail(ctx.body);
          if (email) {
            const { blocked, retryAfterSeconds } =
              checkResetRequestRateLimit(email);
            if (blocked) {
              // Burada kullanici id'si YOKTUR ve aranamaz: sayac, e-postanin
              // kayitli olup olmadigina BAKMADAN isletilir (FR-002 enumeration
              // korumasi). Bu yuzden anahtarlanmis takma ad kullanilir.
              console.warn(
                `[reset] Siklik siniri asildi: ${redactEmail(email)}`,
              ); // FR-012
              throw new APIError('TOO_MANY_REQUESTS', {
                message:
                  'Çok fazla şifre sıfırlama isteği gönderildi. Lütfen daha sonra tekrar deneyin.',
                code: 'TOO_MANY_RESET_REQUESTS',
                retryAfter: retryAfterSeconds,
              });
            }
            recordResetRequest(email);
          }
        }

        if (ctx.path === '/sign-in/email') {
          // FR-017: e-posta bazli throttling (10 basarisiz denemeden sonra 429, artan gecikme)
          const email = readEmail(ctx.body);
          if (email) {
            const { blocked, retryAfterSeconds } = checkRateLimit(email);
            if (blocked) {
              throw new APIError('TOO_MANY_REQUESTS', {
                message:
                  'Çok fazla başarısız deneme. Lütfen daha sonra tekrar deneyin.',
                code: 'TOO_MANY_ATTEMPTS',
                retryAfter: retryAfterSeconds,
              });
            }
          }
          // FR-014: hatali kimlik -> genel 401 mesaji (US2, T031 ile detaylandirilir)
        }
      }),
      // Govde tamamen senkron (yalnizca bellek ici sayac gunceller) ama
      // createAuthMiddleware imzasi Promise DONDURMEYI zorunlu kiliyor;
      // `async`'i kaldirmak TS2345 veriyor. Kural bu tek satirda susturuldu.
      // eslint-disable-next-line @typescript-eslint/require-await
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/sign-in/email') {
          const email = readEmail(ctx.body);
          if (!email) return;

          const response = ctx.context.returned;
          const status =
            response instanceof APIError
              ? (response.statusCode ?? 401)
              : response instanceof Response
                ? response.status
                : 200;

          // Onceden kosul `status >= 400` idi ve bu, sifresi DOGRU olan
          // kullaniciyi cezalandiriyordu: e-postasi henuz dogrulanmamis bir
          // hesap her denemede 403 EMAIL_NOT_VERIFIED alir
          // (requireEmailVerification), her deneme "basarisiz" sayilirdi ve
          // 10. denemede kullanici kendi hesabini kilitlerdi.
          // Kural ve gerekcesi: rate-limit.config.ts signInAttemptOutcome.
          const outcome = signInAttemptOutcome(status);
          if (outcome === 'fail') recordFailedAttempt(email);
          else if (outcome === 'reset') resetAttempts(email);
        }
      }),
    },
  });
}

export type BetterAuthInstance = ReturnType<typeof createAuth>;
export const BETTER_AUTH = Symbol('BETTER_AUTH');
