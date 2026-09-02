// DOSYA REHBERİ: Ödeme/abonelik modülünü NestJS'e tanıtan montaj dosyası.
// Stripe istemcisi STRIPE_CLIENT portundan sağlanır (LlmModule'ün LLM_PROVIDER
// deseniyle aynı) — testler gerçek Stripe'a hiç gitmeden aynı sınırdan sahte
// bir istemci takar.
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { STRIPE_CLIENT, createStripeClient } from './stripe.provider';

@Module({
  // AuthModule: SessionGuard'in bagimliliklari icin (checkout/portal uclari).
  imports: [PrismaModule, AuthModule],
  controllers: [BillingController],
  providers: [
    {
      provide: STRIPE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Stripe =>
        createStripeClient(config.getOrThrow<string>('STRIPE_SECRET_KEY')),
    },
    BillingService,
  ],
})
export class BillingModule {}
