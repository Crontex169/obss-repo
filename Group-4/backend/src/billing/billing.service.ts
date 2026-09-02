// DOSYA REHBERİ: Stripe ile konuşan tek yer. Ödeme/abonelik yönetimi için
// sağlayıcının barındırdığı sayfalara oturum açar ve imzası DOĞRULANMIŞ
// olayları işleyip `User` üstündeki planTier/proUntil alanlarını günceller.
//
// Abonelik durum makinesi (aktif, iptal, gecikmiş, süresi dolmuş) burada
// DEĞİL Stripe'ta yaşar; burada saklanan şey durum değil sonuçtur: hangi
// kademe, ne zamana kadar (ADR-0015, data-model.md).
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { STRIPE_CLIENT } from './stripe.provider';
import type { PlanTier } from './plan';

/** Satin alinabilir kademeler — `free` satin alinamaz. */
export type PaidTier = Exclude<PlanTier, 'free'>;

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private priceIdFor(tier: PaidTier): string {
    return tier === 'pro'
      ? this.config.getOrThrow<string>('STRIPE_PRICE_PRO')
      : this.config.getOrThrow<string>('STRIPE_PRICE_PRO_PLUS');
  }

  /** Fiyat kimliginden kademe. Taninmayan fiyat -> null (plan DEGISTIRILMEZ). */
  private tierForPrice(priceId: string): PaidTier | null {
    if (priceId === this.config.get<string>('STRIPE_PRICE_PRO')) return 'pro';
    if (priceId === this.config.get<string>('STRIPE_PRICE_PRO_PLUS')) {
      return 'pro_plus';
    }
    return null;
  }

  /**
   * Saglayici musteri kaydini bulur ya da olusturur ve kimligi HEMEN kaydeder.
   *
   * Kullanici yonlendirilmeden ONCE yazilmasi sarttir: gelen webhook'lar
   * kullaniciya bu alan uzerinden baglanir. Sonradan yazsaydik, odeme
   * tamamlanip olay geldiginde onu hangi kullaniciya baglayacagimizi bilemez,
   * govdedeki metadata'ya guvenmek zorunda kalirdik.
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

  async createCheckoutSession(
    userId: string,
    tier: PaidTier,
  ): Promise<string> {
    const customerId = await this.ensureCustomer(userId);
    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: this.priceIdFor(tier), quantity: 1 }],
      success_url: `${frontendUrl}/billing/return`,
      cancel_url: `${frontendUrl}/billing`,
    });

    // FR-019: odeme oturumu acilisi kayit altina alinir. Kart verisi ya da
    // saglayici sirri LOGLANMAZ.
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

  /**
   * Imzayi DOGRULAR. Basarisizsa atar; cagiran 400 doner ve veritabanina
   * DOKUNULMAZ (FR-013). Ham govde sart: JSON'a ayristirilip yeniden
   * serilestirilen govdeyle imza tutmaz.
   */
  verifyEvent(rawBody: Buffer, signature: string | undefined): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature ?? '',
      this.config.getOrThrow<string>('STRIPE_WEBHOOK_SECRET'),
    );
  }

  /**
   * YALNIZCA dogrulanmis olay ile cagrilir.
   *
   * Iki olay dinlenir: `invoice.paid` (ilk odeme ve yenilemeler) ve
   * `customer.subscription.updated` (kademe degisimi). Ikisinde de ayni sey
   * yapilir: abonelik Stripe'tan okunur, iki alan birden yazilir. Iptal icin
   * olay dinlenmez — `proUntil` dolar ve kullanici kendiliginden `free` olur.
   */
  async applyEvent(event: Stripe.Event): Promise<void> {
    if (
      event.type !== 'invoice.paid' &&
      event.type !== 'customer.subscription.updated'
    ) {
      return;
    }

    const object = event.data.object as {
      customer?: string | { id: string } | null;
    };
    const customerId =
      typeof object.customer === 'string'
        ? object.customer
        : (object.customer?.id ?? null);
    if (!customerId) return;

    const user = await this.prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
      select: { id: true, proUntil: true },
    });
    if (!user) {
      // Bizim olmayan bir musteri (ornegin ayni Stripe hesabini paylasan baska
      // bir ortam). Sessizce gecilir ama IZ BIRAKILIR — sessiz basarisizlik yok.
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

    const item = subscription.items.data[0];
    if (!item) return;

    const tier = this.tierForPrice(item.price.id);
    if (!tier) {
      // Yapilandirilmamis bir fiyat: plani TAHMIN ETMEYIZ. Yanlis kademe
      // vermektense hic dokunmamak dogru taraftir.
      this.logger.warn(`webhook: taninmayan price priceId=${item.price.id}`);
      return;
    }

    // DIKKAT: `current_period_end` SubscriptionItem uzerindedir. Stripe v22'de
    // Subscription'dan KALDIRILDI (CHANGELOG: "Remove support for
    // current_period_end and current_period_start on Subscription").
    const periodEnd = new Date(item.current_period_end * 1000);

    // IDEMPOTENCY (FR-014): Stripe ayni olayi yeniden gonderir. `max` sayesinde
    // tekrar sonucu degistirmez ve sirasi bozulmus/gec gelen bir olay odenmis
    // sureyi KISALTMAZ. "N gun ekle" tarzi artirma kullanilsaydi her tekrar
    // aboneligi uzatirdi.
    const proUntil =
      user.proUntil && user.proUntil > periodEnd ? user.proUntil : periodEnd;

    await this.prisma.user.update({
      where: { id: user.id },
      data: { planTier: tier, proUntil },
    });
    this.logger.log(`plan guncellendi userId=${user.id} tier=${tier}`);
  }
}
