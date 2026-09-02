// 010-odeme-abonelik entegrasyon testleri icin paylasilan kurulum.
//
// Stripe istemcisi STRIPE_CLIENT portundan override edilir; gercek Stripe'a
// istek atan test YAZILMAZ. Ancak sahte istemci GERCEK bir Stripe ornegidir:
// yalnizca AG CAGRISI YAPAN metodlar (customers.create, checkout.sessions.create,
// subscriptions.list, billingPortal.sessions.create) jest.fn ile degistirilir.
//
// `webhooks.constructEvent` KASITLI OLARAK GERCEK BIRAKILIR — o metod ag
// kullanmaz, gövde/imza/sir uzerinde kripto dogrulamasi kosar. Sahte birakilsaydi
// bu dilimin en kritik testi ("gecersiz imza reddedilir") hicbir sey olcmezdi.
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import Stripe from 'stripe';
import { AppModule } from '../../../src/app.module';
import { HttpExceptionFilter } from '../../../src/common/http-exception.filter';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { STRIPE_CLIENT } from '../../../src/billing/stripe.provider';

export const TEST_WEBHOOK_SECRET = 'whsec_placeholder';
export const TEST_PRICE_PRO = 'price_placeholder_pro';
export const TEST_PRICE_PRO_PLUS = 'price_placeholder_pro_plus';

export interface BillingTestApp {
  app: INestApplication;
  prisma: PrismaService;
  stripe: Stripe;
  /** Ag cagrisi yapan metodlarin jest mock'lari. */
  mocks: {
    customersCreate: jest.Mock;
    checkoutSessionsCreate: jest.Mock;
    subscriptionsList: jest.Mock;
    portalSessionsCreate: jest.Mock;
  };
}

export async function createBillingTestApp(): Promise<BillingTestApp> {
  // Gercek Stripe ornegi: gecerli bir API anahtari gerektirmez cunku ag
  // cagrilarini asagida degistiriyoruz. constructEvent gercek kalir.
  const stripe = new Stripe('sk_test_placeholder');

  const mocks = {
    customersCreate: jest.fn(),
    checkoutSessionsCreate: jest.fn(),
    subscriptionsList: jest.fn(),
    portalSessionsCreate: jest.fn(),
  };

  stripe.customers.create = mocks.customersCreate as never;
  stripe.checkout.sessions.create = mocks.checkoutSessionsCreate as never;
  stripe.subscriptions.list = mocks.subscriptionsList as never;
  stripe.billingPortal.sessions.create = mocks.portalSessionsCreate as never;

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(STRIPE_CLIENT)
    .useValue(stripe)
    .compile();

  const app = moduleRef.createNestApplication({ rawBody: true });
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();

  return { app, prisma: app.get(PrismaService), stripe, mocks };
}

/**
 * Gecerli imzali bir webhook istegi govdesi + basligi uretir.
 * Imza GERCEK Stripe yardimcisiyla uretilir; testin dogruladigi sey bizim
 * dogrulama kodumuzun gercekten calistigidir.
 */
export function signedWebhook(
  stripe: Stripe,
  event: Record<string, unknown>,
): { payload: string; signature: string } {
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: TEST_WEBHOOK_SECRET,
  });
  return { payload, signature };
}

/** `invoice.paid` olayinin testte kullanilan asgari govdesi. */
export function invoicePaidEvent(customerId: string): Record<string, unknown> {
  return {
    id: `evt_${Math.random().toString(36).slice(2)}`,
    object: 'event',
    type: 'invoice.paid',
    data: { object: { object: 'invoice', customer: customerId } },
  };
}

/**
 * `customer.subscription.updated` olayinin testte kullanilan asgari govdesi.
 * Kademe degisimi (pro <-> pro_plus) bu olayla gelir.
 */
export function subscriptionUpdatedEvent(
  customerId: string,
): Record<string, unknown> {
  return {
    id: `evt_${Math.random().toString(36).slice(2)}`,
    object: 'event',
    type: 'customer.subscription.updated',
    data: { object: { object: 'subscription', customer: customerId } },
  };
}

/**
 * `subscriptions.list` yanitinin testte kullanilan asgari sekli.
 *
 * DIKKAT: `current_period_end` SubscriptionItem uzerindedir, Subscription
 * uzerinde DEGIL — Stripe v22'de Subscription'dan kaldirildi (CHANGELOG:
 * "Remove support for current_period_end and current_period_start on
 * Subscription"). Yanlis yerden okunursa tarih `Invalid Date` olur.
 */
export function subscriptionListResponse(
  priceId: string,
  periodEndSeconds: number,
): { data: unknown[] } {
  return {
    data: [
      {
        id: 'sub_test',
        status: 'active',
        items: {
          data: [
            {
              id: 'si_test',
              price: { id: priceId },
              current_period_end: periodEndSeconds,
            },
          ],
        },
      },
    ],
  };
}
