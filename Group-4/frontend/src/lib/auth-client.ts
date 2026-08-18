import { createAuthClient } from 'better-auth/react'
import { oneTapClient } from 'better-auth/client/plugins'

// Better Auth React istemcisi. Backend, /api/auth/* altında NestJS köprüsü ile
// mount edilir (bkz. backend/src/auth/better-auth.controller.ts).
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  plugins: [
    // Google One Tap: Google istemci kimligi backend'deki GOOGLE_CLIENT_ID ile
    // AYNI olmali (bkz. components/auth/google-one-tap.tsx). Client ID Google
    // tarafinda kamuya acik kabul edilir (gizli olan clientSecret'tir) — VITE_
    // ile tarayiciya gitmesi guvenlik sorunu degildir.
    //
    // @ts-expect-error better-auth 1.6.25: oneTapClient'in getActions imzasi
    // BetterAuthClientPlugin kisitiyla bagdasmiyor (upstream generic variance
    // hatasi — $fetch parametresi kontravaryant konumda). Calisma zamani dogru;
    // yalnizca kisit denetimi patliyor ve `tsc -b` prod build'ini durduruyordu.
    // Plugin'in gercek tipi korundugu icin authClient.oneTap cikarimi calisir.
    // better-auth guncellemesinde bu satir hata VERMEZ hale gelirse ts-expect-error
    // kendisi hata verir; yani silinmesi gerektigini derleyici hatirlatir.
    oneTapClient({ clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '' }),
  ],
})

export const { signIn, signUp, signOut, useSession } = authClient

/**
 * Google One Tap istemini acar.
 *
 * Yukaridaki kisit hatasi bastirildigi icin TypeScript plugin'in eylemlerini
 * (`oneTap`) createAuthClient cikarimina katmiyor — client tipi kisitin
 * varsayilanina dusuyor. Erisimi bu tek yardimciya hapsediyoruz ki cast
 * uygulama koduna yayilmasin ve cagri yeri tam tipli kalsin.
 */
export function promptGoogleOneTap(callbackURL: string): Promise<unknown> {
  const client = authClient as unknown as {
    oneTap: (opts: { callbackURL: string }) => Promise<unknown>
  }
  return client.oneTap({ callbackURL })
}

// Oturum store'unu (useSession'in okudugu nanostore atom'u) SUNUCUDAN tazeler.
// Better Auth sign-in basarili olunca $sessionSignal'i 10 ms'lik bir setTimeout
// ile gonderir (better-auth/dist/client/proxy.mjs) ve bu sinyali yalnizca store
// MOUNT ise duyar. /login sayfasinda useSession tuketicisi olmadigindan store
// mount degildir: sinyal hic islenmez, atom bir onceki 401'den kalan
// {data:null, isPending:false} degerini tutmaya devam eder. signIn'den hemen
// sonra navigate edilirse ProtectedRoute bu bayat degeri okuyup kullaniciyi
// /login'e geri atar (kullanicinin gordugu: "ilk denemede giris olmuyor, ikinci
// denemede oluyor"). Yonlendirmeden ONCE bunu await etmek gerekir.
export const refreshSession = () => authClient.$store.atoms.session.get().refetch()
