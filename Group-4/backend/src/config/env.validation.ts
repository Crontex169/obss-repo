// DOSYA REHBERİ: Uygulamanın .env dosyasındaki tüm ortam değişkenlerini
// başlangıçta kontrol eden Zod şeması. Amaç: eksik ya da hatalı bir ayar
// varsa uygulama hiç açılmasın — "yarım çalışan, bir yerde patlayacak" bir
// sürüm production'a çıkmasın.
import { z } from 'zod';
import { passwordPolicy } from '../auth/hooks/password-policy';
export const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL zorunludur'),
    BETTER_AUTH_SECRET: z
      .string()
      .min(32, 'BETTER_AUTH_SECRET en az 32 karakter olmalidir'),
    BETTER_AUTH_URL: z.string().url(),
    FRONTEND_URL: z.string().url(),
    GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID zorunludur'),
    GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET zorunludur'),
    ADMIN_EMAIL: z.string().email('ADMIN_EMAIL gecerli bir e-posta olmalidir'),
    // docs/SECURITY.md S9: seed edilen admin, sistemin EN YETKILI hesabidir ama
    // kayit/sifirlama akislarindaki passwordPolicy'ye (8+ karakter, en az bir
    // harf VE bir rakam) tabi degildi - burada yalnizca min(8) araniyordu, yani
    // "aaaaaaaa" kabul ediliyordu. Ayni tek kaynak (hooks/password-policy.ts)
    // burada da uygulanir ki sistemin en guclu hesabi en zayif kurala kalmasin.
    ADMIN_PASSWORD: passwordPolicy,
    // docs/SECURITY.md S1: Cloudflare quick tunnel joker host'u (*.trycloudflare.com)
    // YALNIZCA bu bayrak acikken kabul edilir. Uretimde acik birakilirsa Host
    // basligi uzerinden sifirlama/dogrulama baglantisi saldirganin alan adina
    // yonlendirilebilir. Yalnizca yerel tunel gelistirmesinde "true" yapin.
    ALLOW_TUNNEL_HOSTS: z
      .enum(['true', 'false'])
      .default('false')
      .describe('Yalnizca yerel tunel gelistirmesi icin true'),
    // docs/SECURITY.md S5: oturum cerezinin sameSite duruşu. Varsayilan `lax`
    // tek-origin/ayni-site deploy icindir. Frontend AYRI bir alan adindaysa
    // cerezin siteler arasi gidebilmesi icin `none` gerekir (ve `secure`
    // otomatik zorunlu olur). Deger acikca yapilandirilir, Better Auth
    // varsayilanina birakilmaz - CSRF savunmasi ortuk bir varsayilana
    // yaslanmamalidir (OriginGuard bu duruştan bagimsiz olarak da korur).
    COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    // docs/SECURITY.md S11: onundeki guvenilen vekil sayisi (Render/Fly/nginx
    // tipik olarak 1). 0 = kapali; istemcinin gonderdigi X-Forwarded-For'a
    // korukorune guvenmek IP bazli siklik sinirini atlatilabilir yapardi.
    TRUST_PROXY: z.coerce
      .number()
      .int()
      .min(0, 'TRUST_PROXY 0 veya daha buyuk bir tamsayi olmalidir')
      .default(0),
    // Yalnizca uretime ozel dogrulamalari acmak icin okunur (asagidaki
    // TRUST_PROXY kontrolu). Uygulamanin geri kalani ortami buradan sormaz.
    NODE_ENV: z.string().optional(),
    MAIL_TRANSPORT: z.enum(['console', 'resend']).default('console'),
    MAIL_FROM: z.string().optional().default('no-reply@example.com'),
    RESEND_API_KEY: z.string().optional().default(''),

    // --- LLM (002-interview) — ADR-0007 ---
    // Saglayici farki yapilandirma verisidir: tek OpenAI-uyumlu adapter,
    // yalnizca baseURL/apiKey/model degisir.
    LLM_PROVIDER: z.enum(['groq', 'deepseek']).default('groq'),
    LLM_BASE_URL: z.string().url('LLM_BASE_URL gecerli bir URL olmalidir'),
    LLM_API_KEY: z.string().min(1, 'LLM_API_KEY zorunludur'),
    LLM_MODEL: z.string().min(1, 'LLM_MODEL zorunludur'),
    // --- Yedek saglayici (opsiyonel) — ADR-0007 R1 ---
    // Birincil cevap veremezse cagri BIR kez buraya devredilir; operasyon
    // ayrimi yoktur. Bos birakilirsa yedek yol kapalidir.
    LLM_ALT_PROVIDER: z.enum(['groq', 'deepseek']).optional(),
    LLM_ALT_BASE_URL: z.string().url().optional(),
    LLM_ALT_API_KEY: z.string().optional(),
    LLM_ALT_MODEL: z.string().optional(),

    // Varsayilan cagri zaman asimi; rapor uretimi kod icinde 60000 ile override eder
    // (docs/API_CONVENTIONS.md 3.2).
    LLM_REQUEST_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .positive('LLM_REQUEST_TIMEOUT_MS pozitif bir tamsayi olmalidir')
      .default(30_000),

    // --- PDF (002-interview) — FR-002 ---
    PDF_MAX_SIZE_MB: z.coerce
      .number()
      .int()
      .positive('PDF_MAX_SIZE_MB pozitif bir tamsayi olmalidir')
      .default(10),
  })
  .superRefine((env, ctx) => {
    // Yedek saglayici ya TAM yapilandirilir ya hic. Yarim birakilirsa
    // (ornegin model verilip anahtar unutulursa) yedek sessizce devre disi
    // kalir ve birincil dustugunde kimse neden devralmadigini anlamaz.
    const altFields = {
      LLM_ALT_PROVIDER: env.LLM_ALT_PROVIDER,
      LLM_ALT_BASE_URL: env.LLM_ALT_BASE_URL,
      LLM_ALT_API_KEY: env.LLM_ALT_API_KEY,
      LLM_ALT_MODEL: env.LLM_ALT_MODEL,
    };
    const verilen = Object.entries(altFields).filter(([, v]) => v);
    if (verilen.length > 0 && verilen.length < 4) {
      for (const [key, value] of Object.entries(altFields)) {
        if (!value) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `Yedek saglayici kismen yapilandirilmis: ${key} de zorunludur (ya hepsi ya hicbiri)`,
          });
        }
      }
    }

    // bulgu A5: MAIL_TRANSPORT=resend iken RESEND_API_KEY bos kalirsa mail
    // gonderimi sessizce basarisiz olur (ADR-0008). Fail-fast: baslangicta hata ver.
    if (env.MAIL_TRANSPORT === 'resend' && !env.RESEND_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RESEND_API_KEY'],
        message: 'MAIL_TRANSPORT=resend iken RESEND_API_KEY zorunludur',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Ortam degisken dogrulamasi basarisiz: ${message}`);
  }

  // docs/SECURITY.md S11 (bulgu S2): varsayilan 0 GELISTIRME icin dogrudur ama
  // uretimde SESSIZ bir arizadir. Ters vekil arkasinda TRUST_PROXY=0 iken
  // `req.ip` daima vekilin IP'sidir; IP basina calisan `default` kovasi (300/60sn)
  // TUM kullanicilar icin TEK ortak kovaya doner ve normal trafikte bile 429
  // uretir. Yanlis yonde de bozulabilir: vekil sayisi fazla verilirse istemcinin
  // gonderdigi X-Forwarded-For'a guvenilir ve sinir tamamen atlatilir.
  //
  // Bu yuzden uretimde deger ACIKCA yazilmalidir. Degerin kendisi serbest
  // (vekil yoksa `TRUST_PROXY=0` yazmak gecerli bir cevaptir) — istenen tek sey,
  // kararin varsayilana birakilmamis olmasidir.
  if (
    parsed.data.NODE_ENV === 'production' &&
    config.TRUST_PROXY === undefined
  ) {
    throw new Error(
      'Ortam degisken dogrulamasi basarisiz: TRUST_PROXY uretimde acikca ' +
        'ayarlanmalidir (vekil yoksa 0, Render/Fly/nginx arkasinda tipik olarak 1)',
    );
  }

  return parsed.data;
}
