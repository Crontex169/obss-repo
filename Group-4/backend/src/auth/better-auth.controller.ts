// DOSYA REHBERİ: NestJS köprüsü — /api/auth/* isteklerinin HEPSİNİ Better
// Auth'un hazır çözümüne devreder. Kendi giriş/kayıt/parola sıfırlama kodumuzu
// yazmadık; bu 20 satır o hazır kütüphaneyi bizim NestJS uygulamamıza "prize
// takıyor". @Res() bilerek kullanılıyor: yanıtı Better Auth'a elden teslim
// ediyoruz, NestJS karışmasın diye.
import { All, Controller, Inject, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { BETTER_AUTH, type BetterAuthInstance } from './better-auth.config';

// NestJS koprusu: /api/auth/* isteklerini Better Auth'un catch-all handler'ina mount eder.
@Controller('api/auth')
export class BetterAuthController {
  private readonly handler: ReturnType<typeof toNodeHandler>;

  constructor(@Inject(BETTER_AUTH) auth: BetterAuthInstance) {
    this.handler = toNodeHandler(auth);
  }

  @All('*path')
  async handle(@Req() req: Request, @Res() res: Response) {
    return this.handler(req, res);
  }
}
