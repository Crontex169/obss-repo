# Tasks: Ödeme ve Abonelik

**Girdi**: `specs/010-odeme-abonelik/plan.md`, `spec.md`, `data-model.md`, `quickstart.md`

**Testler**: Anayasa İlke III (test-first/ATDD) gereği ZORUNLU — her görev için testler koddan ÖNCE yazılır (Red→Green).

**Komutlar**: birim testler `npm --prefix backend test`, entegrasyon testleri
`npm --prefix backend run test:integration`, migration `npm --prefix backend run prisma:migrate`.

## Global Kısıtlar

Her görevin gereksinimlerine örtük olarak dahildir:

- Kota matrisi: `free` = 3, `pro` = 50, `pro_plus` = 100 aylık görüşme (`spec.md` FR-002).
- Kota penceresi: takvim ayı, ayın 1'i 00:00 **UTC** (FR-003).
- Kota aşımı yanıtı `402`, saatlik hız sınırı yanıtı `429` — asla karıştırılmaz (FR-007).
- Plan asla saklanmaz, `proUntil` + `planTier`'dan türetilir (`data-model.md`).
- Kart verisi hiçbir katmanda alınmaz/işlenmez/loglanmaz (FR-011).
- Plan yükseltmesi yalnızca imzası doğrulanmış webhook ile yapılır (FR-012).
- Stripe **yalnızca test modu**; `sk_live_…` anahtarı hiçbir dosyaya girmez.
- Rota prefix'i controller içindedir (`@Controller('api/billing')`), global prefix yok.

---

## Faz 1: Ortak Altyapı (Foundational)

Bu fazın tamamı bitmeden US1 başlayamaz — kota matrisi ve şema alanları hepsinin dayanağı.

- [ ] T001 `docs/DECISIONS.md`: yeni ADR ekle — "Abonelik durumunun sahibi ödeme sağlayıcısıdır". İçerik: Stripe test modu seçimi, `Subscription`/`Plan`/`Invoice` tablolarının BİLEREK yazılmadığı, elenen iki alternatif (kendi tablolarımız / `@better-auth/stripe` eklentisi) ve gerekçeleri. Kaynak: `plan.md` Özet bölümü.

- [ ] T002 `backend/package.json`: `stripe` Node SDK bağımlılığını ekle (`npm --prefix backend install stripe`). Başka yeni bağımlılık EKLENMEZ.

- [ ] T003 `backend/prisma/schema.prisma`: `User` modeline üç alan ekle, ardından `npm --prefix backend run prisma:migrate` ile migration üret.

```prisma
  // 010-odeme-abonelik: abonelik durumunun SAHIBI odeme saglayicisidir; burada
  // durum degil SONUC saklanir. Etkin plan turetilir, saklanmaz:
  //   plan = (proUntil && proUntil > now()) ? planTier : "free"
  stripeCustomerId String?   @unique
  planTier         String? // "pro" | "pro_plus"; null = hic ucretli olmamis
  proUntil         DateTime?
```

- [ ] T004 `backend/src/config/env.validation.ts`: dört anahtarı zod şemasına ekle. Hepsi `.optional()` DEĞİL — eksikse uygulama açılışta patlamalı (mevcut `LLM_API_KEY` deseniyle aynı sertlik).

```ts
    STRIPE_SECRET_KEY: z.string().min(1, 'STRIPE_SECRET_KEY zorunludur'),
    STRIPE_WEBHOOK_SECRET: z.string().min(1, 'STRIPE_WEBHOOK_SECRET zorunludur'),
    STRIPE_PRICE_PRO: z.string().min(1, 'STRIPE_PRICE_PRO zorunludur'),
    STRIPE_PRICE_PRO_PLUS: z.string().min(1, 'STRIPE_PRICE_PRO_PLUS zorunludur'),
```

- [ ] T005 `Group-4/.env.example`: aynı dört anahtarı **boş yer tutucu** olarak ekle (`STRIPE_SECRET_KEY=sk_test_...`). Gerçek anahtar YAZILMAZ.

- [ ] T006 `backend/src/main.ts:12`: `NestFactory.create<NestExpressApplication>(AppModule)` çağrısına `{ rawBody: true }` seçeneğini ekle. Bu olmadan webhook imza doğrulaması ÇALIŞMAZ (gövde yeniden serileştirilince imza tutmaz).

```ts
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
```

- [ ] T007 `backend/test/unit/plan-derivation.spec.ts` YENİ: plan türetimi ve kota matrisi birim testleri (koddan ÖNCE, FAIL beklenir).

```ts
import { resolvePlan, monthlyQuotaFor, currentMonthStartUtc } from '../../src/billing/plan';

describe('resolvePlan', () => {
  const future = new Date(Date.now() + 86_400_000);
  const past = new Date(Date.now() - 86_400_000);

  it('proUntil null -> free', () => {
    expect(resolvePlan({ planTier: null, proUntil: null })).toBe('free');
  });

  it('proUntil gecmis -> free (planTier dolu olsa bile)', () => {
    expect(resolvePlan({ planTier: 'pro', proUntil: past })).toBe('free');
  });

  it('proUntil gelecek -> planTier', () => {
    expect(resolvePlan({ planTier: 'pro_plus', proUntil: future })).toBe('pro_plus');
  });

  it('proUntil gelecek ama planTier null -> free (tutarsiz kayit guvenli tarafa duser)', () => {
    expect(resolvePlan({ planTier: null, proUntil: future })).toBe('free');
  });
});

describe('monthlyQuotaFor', () => {
  it('kademe basina kota', () => {
    expect(monthlyQuotaFor('free')).toBe(3);
    expect(monthlyQuotaFor('pro')).toBe(50);
    expect(monthlyQuotaFor('pro_plus')).toBe(100);
  });
});

describe('currentMonthStartUtc', () => {
  it('ayin ilk gunu 00:00 UTC dondurur', () => {
    const d = currentMonthStartUtc(new Date('2026-09-17T13:45:00Z'));
    expect(d.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('ayin ilk saniyesinde o ayi dondurur (bir onceki ayi DEGIL)', () => {
    const d = currentMonthStartUtc(new Date('2026-09-01T00:00:00Z'));
    expect(d.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('yerel saat dilimi degil UTC kullanir', () => {
    // UTC+3'te bu an 1 Ekim 02:00, ama UTC'de hala 30 Eylul 23:00 -> Eylul penceresi
    const d = currentMonthStartUtc(new Date('2026-09-30T23:00:00Z'));
    expect(d.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });
});
```

- [ ] T008 Testi çalıştır, FAIL gördüğünü doğrula: `npm --prefix backend test -- plan-derivation`. Beklenen: `Cannot find module '../../src/billing/plan'`.

- [ ] T009 `backend/src/billing/plan.ts` YENİ: T007'yi geçiren minimum kod. Kota matrisinin ve plan türetiminin **tek kaynağı** budur; guard, `/me` ve webhook hepsi buradan okur.

```ts
// DOSYA REHBERİ: Plan kademesi ve aylık kota matrisinin TEK kaynağı. Etkin plan
// veritabanında saklanmaz; kullanıcının planTier + proUntil alanlarından burada
// türetilir. Kota limitleri DB'de değil burada sabittir (bkz. data-model.md).
export type PlanTier = 'free' | 'pro' | 'pro_plus';

const MONTHLY_QUOTA: Record<PlanTier, number> = {
  free: 3,
  pro: 50,
  pro_plus: 100,
};

export function monthlyQuotaFor(plan: PlanTier): number {
  return MONTHLY_QUOTA[plan];
}

/**
 * Etkin plan. proUntil gecmisse veya yoksa kullanici `free`dir; planTier gecmis
 * bir donemle birlikte kayitta KALIR ama hicbir hak vermez (data-model.md).
 * planTier taninmayan bir deger tutuyorsa guvenli tarafa (free) duseriz.
 */
export function resolvePlan(user: {
  planTier: string | null;
  proUntil: Date | null;
}): PlanTier {
  if (!user.proUntil || user.proUntil.getTime() <= Date.now()) return 'free';
  if (user.planTier === 'pro' || user.planTier === 'pro_plus') return user.planTier;
  return 'free';
}

/** Kota penceresinin baslangici: icinde bulunulan ayin 1'i 00:00 UTC. */
export function currentMonthStartUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
```

- [ ] T010 Testi çalıştır, PASS gördüğünü doğrula: `npm --prefix backend test -- plan-derivation`.

- [ ] T011 Commit.

```bash
git add backend/prisma backend/src/billing/plan.ts backend/src/config/env.validation.ts \
  backend/src/main.ts backend/test/unit/plan-derivation.spec.ts backend/package.json \
  .env.example docs/DECISIONS.md
git commit -m "feat(billing): plan kademesi, kota matrisi ve abonelik semasi"
```

**Checkpoint**: Şema, kota matrisi ve ham gövde desteği hazır. US1 ve US2 bunlara bağımlı.

---

## Faz 2: User Story 1 — Aylık kota kısıtı (Priority: P1)

**Goal**: Kotası dolan kullanıcı yeni görüşme başlatamaz (402), ama yarım kalan görüşmesine devam edebilir. Ödeme akışı olmadan bağımsız teslim edilebilir — herkes `free` kabul edilir.

### Testler (önce yazılır, FAIL beklenir)

- [ ] T012 [P] [US1] `backend/test/integration/us1-quota-blocks-create.spec.ts` YENİ: `free` kullanıcı 3 görüşme oluşturur (200), 4.'sü `402` ve gövdede `plan`/`used`/`limit` döner.

```ts
import request from 'supertest';
import { createInterviewTestApp, type InterviewTestApp } from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { createTestInterview } from './helpers/create-test-interview';
import { fakeQuestions } from './helpers/fake-questions';

describe('US1 - aylik kota yeni gorusmeyi engeller', () => {
  let ctx: InterviewTestApp;
  let cookies: string[];
  const email = `quota-block-${Date.now()}@example.com`;

  beforeAll(async () => {
    ctx = await createInterviewTestApp();
    cookies = await registerAndSignIn(ctx.app, ctx.prisma, email);
  });

  afterAll(async () => {
    await ctx.prisma.user.deleteMany({ where: { email } });
    await ctx.app.close();
  });

  it('free kotasi (3) kadar gorusme olusturulabilir', async () => {
    for (let i = 0; i < 3; i++) {
      await createTestInterview(ctx, cookies);
    }
    const count = await ctx.prisma.interview.count({
      where: { user: { email } },
    });
    expect(count).toBe(3);
  });

  it('4. gorusme 402 ile reddedilir ve plan/used/limit doner', async () => {
    ctx.fakeLlm.always({ content: fakeQuestions(5) });
    const res = await request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', cookies)
      .send({
        jobPostingSource: 'text',
        jobPostingText: 'Gecerli bir is ilani metni.',
        questionCount: 5,
        mode: 'written',
        level: 'mid',
        language: 'tr',
      });

    expect(res.status).toBe(402);
    expect(res.body).toMatchObject({ plan: 'free', used: 3, limit: 3 });
  });

  it('reddedilen istek 429 DEGILDIR (saatlik limit ile karistirilmaz)', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', cookies)
      .send({
        jobPostingSource: 'text',
        jobPostingText: 'Gecerli bir is ilani metni.',
        questionCount: 5,
        mode: 'written',
        level: 'mid',
        language: 'tr',
      });
    expect(res.status).not.toBe(429);
  });

  it('proUntil ileri alininca ayni kullanici tekrar gorusme acabilir', async () => {
    await ctx.prisma.user.update({
      where: { email },
      data: { planTier: 'pro', proUntil: new Date(Date.now() + 86_400_000) },
    });
    const { interviewId } = await createTestInterview(ctx, cookies);
    expect(interviewId).toBeTruthy();
  });
});
```

- [ ] T013 [P] [US1] `backend/test/integration/us1-quota-allows-resume.spec.ts` YENİ: kotası dolmuş kullanıcının **var olan** görüşmesine cevap vermesi ve rapor üretmesi çalışmaya devam eder; kota sayımı ARTMAZ. `POST /api/interviews/:id/answers` ve `POST /api/interviews/:id/report/retry` uçları test edilir. Kritik iddia: test sonunda `interview.count` değişmemiştir ve yanıtlar `402` DEĞİLDİR.

- [ ] T014 [P] [US1] `backend/test/integration/us1-quota-counts-deleted.spec.ts` YENİ: `free` kullanıcı 3 görüşme açar, birini siler (`deletedAt` dolar), 4. görüşme yine `402` alır — silme hak İADE ETMEZ (`spec.md` FR-005).

- [ ] T015 [US1] Testleri çalıştır, FAIL gördüğünü doğrula: `npm --prefix backend run test:integration -- us1-quota`. Beklenen: 4. görüşmede `402` yerine `201` (guard henüz yok).

### Implementasyon

- [ ] T016 [US1] `backend/src/common/guards/plan-quota.guard.ts` YENİ.

```ts
// DOSYA REHBERİ: Aylık plan kotası. Kullanıcının içinde bulunduğu takvim ayında
// oluşturduğu görüşme sayısını planının limitiyle karşılaştırır, aşımda 402 atar.
// SAATLİK hız sınırından (llm-rate-limit.guard.ts) AYRI bir katmandır: o kötüye
// kullanım savunması (429), bu ticari kısıt (402).
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { currentMonthStartUtc, monthlyQuotaFor, resolvePlan } from '../../billing/plan';
import type { AuthUser } from '../../auth/decorators/current-user.decorator';

@Injectable()
export class PlanQuotaGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const userId = req.user!.id;

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { planTier: true, proUntil: true },
    });
    const plan = resolvePlan(user);
    const limit = monthlyQuotaFor(plan);

    // deletedAt FILTRESI BILEREK YOK: silinen gorusme de sayilir, yoksa
    // "olustur -> sil -> olustur" sinirsiz kota olurdu (spec.md FR-005).
    // ponytail: transaction yok — es zamanli iki istek limiti en fazla 1
    // asabilir. Onemli hale gelirse sayimi SERIALIZABLE transaction'a al.
    const used = await this.prisma.interview.count({
      where: { userId, createdAt: { gte: currentMonthStartUtc() } },
    });

    if (used >= limit) {
      throw new HttpException(
        { message: 'Aylik gorusme hakkiniz doldu.', plan, used, limit },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    return true;
  }
}
```

- [ ] T017 [US1] `backend/src/interview/interview.controller.ts:79`: guard'ı ekle. **Sıra kritik** — `PlanQuotaGuard` önce gelir, yoksa hakkı dolu kullanıcı reddedilirken saatlik hakkını da yakar (`spec.md` FR-009).

```ts
  @Post()
  @UseGuards(PlanQuotaGuard, LlmRateLimitGuard)
```

- [ ] T018 [US1] `backend/src/interview/interview.module.ts`: `PlanQuotaGuard`'ı `providers`'a ekle (`PrismaService` enjekte edebilmesi için). Diğer görüşme uçlarına (`:id/answers`, `:id/report/retry`, `:id/transcribe`) guard EKLENMEZ — "devam etmek bedava" kuralı budur.

- [ ] T019 [US1] Testleri çalıştır, PASS gördüğünü doğrula: `npm --prefix backend run test:integration -- us1-quota` ve regresyon için `npm --prefix backend run test:integration -- interview`.

- [ ] T020 [US1] Commit.

```bash
git add backend/src/common/guards/plan-quota.guard.ts backend/src/interview \
  backend/test/integration/us1-quota-*.spec.ts
git commit -m "feat(billing): aylik plan kotasi gorusme olusturmayi kisitlar (402)"
```

**Checkpoint**: US1 bağımsız çalışır. Herkes `free`, kota uygulanıyor, devam etmek bedava. Ödeme henüz yok.

---

## Faz 3: User Story 2 — Ücretli plana geçiş (Priority: P1)

**Goal**: Kullanıcı Stripe Checkout ile ödeme yapar; imzası doğrulanmış webhook planı yükseltir.

### Testler (önce yazılır, FAIL beklenir)

- [ ] T021 [P] [US2] `backend/test/integration/us2-webhook-invalid-signature.spec.ts` YENİ — **bu dilimin en kritik testi**. Geçersiz imzada yanıt 400 olmalı VE veritabanı değişmemiş olmalı.

```ts
import request from 'supertest';

describe('US2 - gecersiz imzali webhook', () => {
  // ... app + prisma kurulumu, kullanici olusturulur (proUntil: null)

  it('gecersiz imza -> 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/billing/webhook')
      .set('stripe-signature', 't=1,v1=sahte')
      .set('Content-Type', 'application/json')
      .send({ type: 'invoice.paid', data: { object: { customer: 'cus_test' } } });

    expect(res.status).toBe(400);
  });

  it('imza basligi HIC YOKKEN -> 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/billing/webhook')
      .set('Content-Type', 'application/json')
      .send({ type: 'invoice.paid', data: { object: { customer: 'cus_test' } } });

    expect(res.status).toBe(400);
  });

  it('gecersiz imzali istek VERITABANINI DEGISTIRMEDI', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.proUntil).toBeNull();
    expect(user.planTier).toBeNull();
  });
});
```

- [ ] T022 [P] [US2] `backend/test/integration/us2-webhook-upgrades-plan.spec.ts` YENİ: geçerli imzalı `invoice.paid` olayı → `planTier` ve `proUntil` yazılır, `/api/users/me` `plan: "pro"` ve `interviewsLimit: 50` döner. Geçerli imza `stripe.webhooks.generateTestHeaderString({ payload, secret })` ile üretilir; kullanıcı `stripeCustomerId` üzerinden bulunur.

- [ ] T023 [P] [US2] `backend/test/integration/us2-webhook-idempotent.spec.ts` YENİ: aynı geçerli olay **iki kez** gönderilir → `proUntil` ikinci gönderimden sonra da AYNI değerdedir (uzamaz). `spec.md` FR-014.

- [ ] T024 [P] [US2] `backend/test/integration/us2-checkout-session.spec.ts` YENİ: oturumsuz `POST /api/billing/checkout` → 401; oturumlu istek → 200 ve gövdede `url`; çağrı sonrası kullanıcının `stripeCustomerId` alanı DOLMUŞTUR (yönlendirmeden önce yazılır, `plan.md` Güvenlik/3). Stripe SDK mock'lanır, ağ çağrısı yoktur. Geçersiz kademe (`tier: "altin"`) → 400.

- [ ] T025 [US2] Testleri çalıştır, FAIL gördüğünü doğrula: `npm --prefix backend run test:integration -- us2-`. Beklenen: 404 (uçlar yok).

### Implementasyon

- [ ] T026 [US2] `backend/src/billing/billing.service.ts` YENİ: Stripe istemcisi, checkout oturumu ve olay işleme.

```ts
// DOSYA REHBERİ: Stripe ile konuşan tek yer. Checkout/portal oturumu açar ve
// imzası DOĞRULANMIŞ olayları işleyip User üstündeki planTier/proUntil alanlarını
// günceller. Abonelik durum makinesi burada DEĞİL Stripe'ta yaşar.
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import type { PlanTier } from './plan';

type PaidTier = Exclude<PlanTier, 'free'>;

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.stripe = new Stripe(this.config.getOrThrow<string>('STRIPE_SECRET_KEY'));
  }

  private priceIdFor(tier: PaidTier): string {
    return tier === 'pro'
      ? this.config.getOrThrow<string>('STRIPE_PRICE_PRO')
      : this.config.getOrThrow<string>('STRIPE_PRICE_PRO_PLUS');
  }

  private tierForPrice(priceId: string): PaidTier | null {
    if (priceId === this.config.get<string>('STRIPE_PRICE_PRO')) return 'pro';
    if (priceId === this.config.get<string>('STRIPE_PRICE_PRO_PLUS')) return 'pro_plus';
    return null;
  }

  /**
   * Stripe musteri kaydini bulur ya da olusturur ve kimligi HEMEN kaydeder.
   * Kullanici yonlendirilmeden ONCE yazilmasi sart: gelen webhook'lar kullaniciya
   * bu alan uzerinden baglanir, govdedeki metadata'ya GUVENILMEZ (plan.md/3).
   */
  private async ensureCustomer(userId: string): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, stripeCustomerId: true },
    });
    if (user.stripeCustomerId) return user.stripeCustomerId;

    const customer = await this.stripe.customers.create({ email: user.email });
    await this.prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });
    return customer.id;
  }

  async createCheckoutSession(userId: string, tier: PaidTier): Promise<string> {
    const customerId = await this.ensureCustomer(userId);
    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: this.priceIdFor(tier), quantity: 1 }],
      success_url: `${frontendUrl}/billing/return`,
      cancel_url: `${frontendUrl}/billing`,
    });

    this.logger.log(`checkout oturumu acildi userId=${userId} tier=${tier}`);
    if (!session.url) throw new BadRequestException('Odeme oturumu acilamadi.');
    return session.url;
  }

  async createPortalSession(userId: string): Promise<string> {
    const customerId = await this.ensureCustomer(userId);
    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${frontendUrl}/billing`,
    });
    return session.url;
  }

  /** Imzayi DOGRULAR. Basarisizsa atar — cagiran 400 doner, DB'ye dokunulmaz. */
  verifyEvent(rawBody: Buffer, signature: string | undefined): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature ?? '',
      this.config.getOrThrow<string>('STRIPE_WEBHOOK_SECRET'),
    );
  }

  /**
   * Yalnizca DOGRULANMIS olay ile cagrilir. Ilgilenilen olaylarda aboneligi
   * Stripe'tan okur ve iki alani birden yazar; diger olaylar sessizce gecilir.
   */
  async applyEvent(event: Stripe.Event): Promise<void> {
    if (event.type !== 'invoice.paid' && event.type !== 'customer.subscription.updated') {
      return;
    }

    const object = event.data.object as { customer?: string | { id: string } };
    const customerId =
      typeof object.customer === 'string' ? object.customer : object.customer?.id;
    if (!customerId) return;

    const user = await this.prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
      select: { id: true, proUntil: true },
    });
    if (!user) {
      this.logger.warn(`webhook: eslesen kullanici yok customerId=${customerId}`);
      return;
    }

    const subscriptions = await this.stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });
    const subscription = subscriptions.data[0];
    if (!subscription) return;

    const priceId = subscription.items.data[0]?.price.id ?? '';
    const tier = this.tierForPrice(priceId);
    if (!tier) {
      this.logger.warn(`webhook: taninmayan price priceId=${priceId}`);
      return;
    }

    // DIKKAT: `current_period_end` alaninin yeri Stripe API surumune gore
    // degisir — eski surumlerde subscription uzerinde, yenilerde subscription
    // item uzerindedir. T002'de kurulan SDK'nin tiplerine bakarak dogrula;
    // yanlis yerden okumak `Invalid Date` uretir ve plani sessizce bozar.
    const periodEnd = new Date(subscription.items.data[0].current_period_end * 1000);
    // max(): IDEMPOTENCY. Ayni olay tekrar gelirse tarih ILERI GITMEZ. "N gun
    // ekle" tarzi artirma kullanilmaz, tekrar gonderimde carpardi (FR-014).
    const proUntil =
      user.proUntil && user.proUntil > periodEnd ? user.proUntil : periodEnd;

    await this.prisma.user.update({
      where: { id: user.id },
      data: { planTier: tier, proUntil },
    });
    this.logger.log(`plan guncellendi userId=${user.id} tier=${tier}`);
  }
}
```

- [ ] T027 [US2] `backend/src/billing/billing.controller.ts` YENİ: üç uç nokta. Webhook `SessionGuard` ALMAZ (Stripe çerez göndermez); tek koruması imzadır.

```ts
// DOSYA REHBERİ: Ödeme uçları. /checkout ve /portal oturum gerektirir; /webhook
// GEREKTIREMEZ (Stripe cerez gondermez) — onun TEK korumasi Stripe imzasidir.
// OriginGuard bu istegi gecirir cunku Origin basligi yoktur; bu kasitlidir
// (origin.guard.ts), dolayisiyla imza dogrulamasi atlanirsa uc nokta korumasiz
// kalir. Bkz. plan.md "Güvenlik".
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { SessionGuard } from '../auth/guards/session.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { BillingService } from './billing.service';
import type { AuthUser } from '../auth/decorators/current-user.decorator';

const checkoutSchema = z.object({ tier: z.enum(['pro', 'pro_plus']) });
type CheckoutInput = z.infer<typeof checkoutSchema>;

@Controller('api/billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(private readonly billing: BillingService) {}

  @Post('checkout')
  @UseGuards(SessionGuard)
  @HttpCode(HttpStatus.OK)
  async checkout(
    @Req() req: Request & { user?: AuthUser },
    @Body(new ZodValidationPipe(checkoutSchema)) dto: CheckoutInput,
  ): Promise<{ url: string }> {
    return { url: await this.billing.createCheckoutSession(req.user!.id, dto.tier) };
  }

  @Post('portal')
  @UseGuards(SessionGuard)
  @HttpCode(HttpStatus.OK)
  async portal(@Req() req: Request & { user?: AuthUser }): Promise<{ url: string }> {
    return { url: await this.billing.createPortalSession(req.user!.id) };
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(@Req() req: RawBodyRequest<Request>): Promise<{ received: true }> {
    if (!req.rawBody) throw new BadRequestException('Ham govde yok.');

    let event;
    try {
      event = this.billing.verifyEvent(req.rawBody, req.headers['stripe-signature'] as string);
    } catch {
      // Govde LOGLANMAZ (FR-020) — yalnizca reddedildigi bilgisi.
      this.logger.warn('webhook imzasi dogrulanamadi, istek reddedildi');
      throw new BadRequestException('Imza dogrulanamadi.');
    }

    await this.billing.applyEvent(event);
    return { received: true };
  }
}
```

- [ ] T028 [US2] `backend/src/billing/billing.module.ts` YENİ: `BillingController` + `BillingService` + `PrismaModule`/`ConfigModule` bağla; `backend/src/app.module.ts` `imports`'a `BillingModule` ekle.

- [ ] T029 [US2] `backend/src/common/log-redaction.ts`: `stripe-signature` başlığını, `STRIPE_*` ortam değişkenlerini ve `/api/billing/webhook` gövdesini redaksiyon kapsamına ekle (`spec.md` FR-020).

- [ ] T030 [US2] Testleri çalıştır, PASS gördüğünü doğrula: `npm --prefix backend run test:integration -- us2-`.

- [ ] T031 [US2] Commit.

```bash
git add backend/src/billing backend/src/app.module.ts backend/src/common/log-redaction.ts \
  backend/test/integration/us2-*.spec.ts
git commit -m "feat(billing): Stripe checkout, portal ve imzali webhook ile plan yukseltme"
```

**Checkpoint**: Ödeme uçtan uca çalışıyor. `quickstart.md` adımlarıyla elle doğrula.

---

## Faz 4: User Story 3 — Yenileme, iptal, sona erme (Priority: P2)

**Goal**: Ödenmiş dönem bitince kullanıcı kendiliğinden `free`'ye düşer; iptal için kod çalışmaz.

- [ ] T032 [P] [US3] `backend/test/integration/us3-expired-falls-back-to-free.spec.ts` YENİ: `planTier: 'pro'` + `proUntil` geçmişte olan kullanıcı → `/api/users/me` `plan: "free"`, `interviewsLimit: 3` döner; 4. görüşme `402` alır. Zamanlanmış iş (cron) OLMADAN çalıştığı doğrulanır.

- [ ] T033 [P] [US3] `backend/test/integration/us3-tier-change.spec.ts` YENİ: `pro` kullanıcıya `customer.subscription.updated` olayı `pro_plus` fiyatıyla gelir → `planTier: 'pro_plus'`, `interviewsLimit: 100`; `proUntil` DEĞİŞMEZ.

- [ ] T034 [US3] Testleri çalıştır. Faz 3'teki `applyEvent` bunları zaten karşılamalı; karşılamıyorsa eksik olan kadarını ekle. İptal için **yeni kod yazılmaz** — davranış `resolvePlan`'dan gelir.

- [ ] T035 [US3] Commit: `git commit -m "test(billing): abonelik sona ermesi ve kademe degisimi"`.

**Checkpoint**: Abonelik yaşam döngüsünün tamamı test altında.

---

## Faz 5: User Story 4 — Kalan hakkın görünmesi (Priority: P2)

**Goal**: Kullanıcı planını ve kalan hakkını görür.

- [ ] T036 [P] [US4] `backend/test/integration/us4-me-quota-fields.spec.ts` YENİ: `/api/users/me` yanıtı `plan`, `interviewsUsed`, `interviewsLimit` alanlarını içerir; yeni kullanıcıda `{ plan: 'free', interviewsUsed: 0, interviewsLimit: 3 }`; bir görüşme sonrası `interviewsUsed: 1`. Mevcut alanların (`kvkkConsentAt`, `hasPassword`, `cvFileName`) KAYBOLMADIĞI da doğrulanır.

- [ ] T037 [US4] Testi çalıştır, FAIL gördüğünü doğrula.

- [ ] T038 [US4] `backend/src/users/users.service.ts` `getKvkkConsent`: dönen nesneye üç alan ekle. Sayım ve limit `billing/plan.ts`'ten okunur — kota matrisi ikinci kez YAZILMAZ.

```ts
    const plan = resolvePlan(user); // select'e planTier + proUntil eklenir
    const interviewsUsed = await this.prisma.interview.count({
      where: { userId, createdAt: { gte: currentMonthStartUtc() } },
    });
    return {
      // ...mevcut alanlar
      plan,
      interviewsUsed,
      interviewsLimit: monthlyQuotaFor(plan),
    };
```

- [ ] T039 [US4] Testi çalıştır, PASS gördüğünü doğrula; `npm --prefix backend run test:integration -- kvkk-consent cv-profile` ile regresyon kontrolü yap.

- [ ] T040 [US4] Commit: `git commit -m "feat(billing): /users/me plan ve kota bilgisini doner"`.

---

## Faz 6: Frontend

- [ ] T041 [P] `frontend/src/pages/billing/PricingPage.tsx` YENİ: üç kademe kartı (Free 3 / Pro 50 / Pro+ 100 aylık görüşme). Ücretli kartlar `POST /api/billing/checkout` ile `{ tier }` gönderir, dönen `url`'e `window.location.assign` yapar. Mevcut kullanıcı ücretliyse "Aboneliği yönet" düğmesi `POST /api/billing/portal` çağırır. Fiyat metni Stripe'ta tanımlı olduğu için ekranda **yazılmaz**; kart yalnızca kotayı anlatır (`spec.md` Assumptions).

- [ ] T042 [P] `frontend/src/pages/billing/BillingReturnPage.tsx` YENİ: `success_url` hedefi. "Ödemeniz işleniyor" gösterir ve `/api/users/me`'yi 2 sn aralıkla en fazla 30 sn yoklar; `plan !== 'free'` olunca başarı mesajı gösterip dashboard'a yönlendirir, süre dolarsa "işlem birkaç dakika sürebilir" mesajı gösterir. Planı bu sayfa YÜKSELTMEZ — yalnızca okur (`spec.md` FR-012).

- [ ] T043 [P] `frontend/src/components/QuotaBadge.tsx` YENİ: `/api/users/me`'den `interviewsUsed`/`interviewsLimit` okuyup "Bu ay 2/3 görüşme" gösterir; kota dolduğunda fiyatlandırma sayfasına yönlendiren bir çağrı gösterir.

- [ ] T044 `frontend/src/pages/interview/*`: görüşme oluşturma ekranında `402` yanıtını yakala ve genel hata yerine plan yükseltme çağrısı göster. `429` yanıtı MEVCUT davranışını korur — iki durum karıştırılmaz (`spec.md` FR-007).

- [ ] T045 [P] `frontend/test/billing/pricing-page.spec.tsx` + `billing-return.spec.tsx` + `quota-badge.spec.tsx` YENİ: kademe seçimi checkout çağrısı yapar; return sayfası plan yükselene kadar yoklar; rozet kotayı ve dolu durumu doğru gösterir. `fetch` mock'lanır.

- [ ] T046 Frontend testlerini çalıştır: `npm --prefix frontend test`.

- [ ] T047 Commit: `git commit -m "feat(billing): fiyatlandirma sayfasi, odeme donusu ve kota rozeti"`.

---

## Faz 7: Dokümantasyon ve kapanış

- [ ] T048 `docs/PROJECT_MAP.md`: `010-odeme-abonelik` dilimini ve yeni `backend/src/billing/` dizinini kod haritasına ekle, durumunu işaretle.

- [ ] T049 `docs/API_CONVENTIONS.md`: `402` kota aşımı yanıtını belgele ve `429`'dan farkını yaz (bölüm 3.5'in yanına). `SETUP.md`: Stripe test modu kurulumu için `specs/010-odeme-abonelik/quickstart.md`'ye referans ver.

- [ ] T050 `AI-DEVLOG.md`: dilim kaydını ekle (Anayasa İlke I).

- [ ] T051 Tüm test paketini çalıştır: `npm --prefix backend run test:cov:all` ve `npm --prefix frontend test`. Hepsi yeşil olmadan dilim kapanmaz.

- [ ] T052 Commit: `git commit -m "docs(billing): odeme dilimi dokumantasyonu ve devlog"`.

---

## Bağımlılık Özeti

```
Faz 1 (T001-T011)  ──> hepsinin ön koşulu
   ├──> Faz 2 (US1, T012-T020)   bağımsız teslim edilebilir
   ├──> Faz 3 (US2, T021-T031)   ödeme akışı
   │       └──> Faz 4 (US3, T032-T035)
   └──> Faz 5 (US4, T036-T040)   Faz 2 sonrası herhangi bir zamanda
          └──> Faz 6 (frontend, T041-T047)  Faz 3 + Faz 5 sonrası
                 └──> Faz 7 (T048-T052)
```

`[P]` işaretli görevler birbirinden bağımsızdır, paralel yürütülebilir.

## Kapsam Dışı (bu dilimde YAPILMAZ)

Borç takibi (dunning), fatura arşivi, kupon/indirim, yıllık plan, takım planı,
vergi/fatura belgesi, para iadesi, kademeye bağlı özellik kilidi (sesli mod, PDF
rapor vb. tüm kademelerde açıktır). Gerekçe: `spec.md` Assumptions.
