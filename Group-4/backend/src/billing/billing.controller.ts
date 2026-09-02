// DOSYA REHBERİ: Ödeme uç noktaları. /checkout ve /portal oturum gerektirir;
// /webhook GEREKTİREMEZ çünkü Stripe çerez göndermez.
//
// GÜVENLİK — bu dosyanın en önemli notu:
// /webhook'un TEK koruması Stripe imzasıdır. Sınıf seviyesinde SessionGuard
// YOKTUR (Stripe oturum açamaz) ve OriginGuard bu isteği geçirir çünkü `Origin`
// başlığı yoktur — origin.guard.ts bunu kasıtlı olarak serbest bırakır
// (tarayıcı dışı istemcide CSRF kavramı yoktur, gerekçesi o dosyada yazılı).
// Dolayısıyla imza doğrulaması atlanır ya da bozulursa, adresi bilen herkes
// kendisine ücretli plan tanımlayabilir. Bkz. specs/010-odeme-abonelik/plan.md.
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { SessionGuard } from '../auth/guards/session.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { BillingService } from './billing.service';

// `free` BILEREK yok: ucretsiz kademe satin alinmaz, ona donus aboneligin
// suresi dolunca kendiliginden olur.
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
    const url = await this.billing.createCheckoutSession(
      req.user!.id,
      dto.tier,
    );
    return { url };
  }

  @Post('portal')
  @UseGuards(SessionGuard)
  @HttpCode(HttpStatus.OK)
  async portal(
    @Req() req: Request & { user?: AuthUser },
  ): Promise<{ url: string }> {
    return { url: await this.billing.createPortalSession(req.user!.id) };
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    // Ham govde olmadan imza dogrulanamaz (main.ts `rawBody: true`).
    if (!req.rawBody) throw new BadRequestException('Ham govde yok.');

    let event;
    try {
      event = this.billing.verifyEvent(
        req.rawBody,
        req.headers['stripe-signature'] as string | undefined,
      );
    } catch {
      // FR-020: olay govdesi ve saglayici hatasi LOGLANMAZ — yalnizca
      // reddedildigi bilgisi. FR-019: sessiz basarisizlik da yok.
      this.logger.warn('webhook imzasi dogrulanamadi, istek reddedildi');
      throw new BadRequestException('Imza dogrulanamadi.');
    }

    await this.billing.applyEvent(event);

    // Stripe icin 2xx "teslim alindi" demektir. Ilgilenmedigimiz olaylarda da
    // 200 doneriz; hata donseydi Stripe onlari saatlerce yeniden gonderirdi.
    return { received: true };
  }
}
