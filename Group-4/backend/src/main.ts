// DOSYA REHBERİ: Uygulamanın başlangıç noktası: sunucuyu ayağa kaldırır,
// hata biçimlendirme ve istek süresi ölçme gibi genel katmanları bağlar,
// CORS'u (hangi frontend adresinin bu backend'e istek atabileceğini)
// ayarlar ve dinlemeye başlar.
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { RequestTimingInterceptor } from './common/request-timing.interceptor';

async function bootstrap() {
  // rawBody: 010-odeme-abonelik. Stripe webhook imzasi HAM govde uzerinden
  // dogrulanir; govde JSON'a ayristirilip yeniden serilestirilirse imza TUTMAZ
  // ve tum webhook'lar sessizce 400'e duser. Bu secenek olmadan odeme akisi
  // calismaz (specs/010-odeme-abonelik/plan.md "Güvenlik").
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // docs/SECURITY.md S11: ters vekil arkasinda `req.ip` vekilin IP'sini doner ve
  // IP bazli siklik siniri (GlobalThrottleGuard) tum kullanicilar icin TEK ortak
  // kovaya donusur. TRUST_PROXY, onunde kac vekil oldugunu soyler (Render/Fly/
  // nginx tipik olarak 1). Varsayilan 0 = kapali: yanlis yapilandirilmis bir
  // deploy'da istemcinin gonderdigi X-Forwarded-For'a KORU KORUNE guvenmek,
  // siklik sinirini tamamen atlatilabilir yapardi.
  const trustProxy = Number(process.env.TRUST_PROXY ?? 0);
  if (Number.isFinite(trustProxy) && trustProxy > 0) {
    app.set('trust proxy', trustProxy);
  }

  // Guvenlik basliklari (helmet) app.module.ts'te modul middleware'i olarak
  // baglidir — boylece entegrasyon testleri de ayni yapilandirmadan gecer
  // (docs/SECURITY.md S6).

  // Ortak hata zarfi — docs/API_CONVENTIONS.md 2 (tum dikeyler icin gecerli).
  app.useGlobalFilters(new HttpExceptionFilter());
  // Endpoint sureleri — docs/METRICS.md. Yalnizca loglar, yanit sozlesmesine
  // dokunmaz; bu yuzden testlerdeki app kurulumlarina eklemek gerekmez.
  app.useGlobalInterceptors(new RequestTimingInterceptor());
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}
// void: bootstrap bilerek beklenmez (surec yasam dongusunu Nest yonetir);
// isaret olmadan no-floating-promises uyarisi veriyordu.
void bootstrap();
