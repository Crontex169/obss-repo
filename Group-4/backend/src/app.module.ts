// DOSYA REHBERİ: Tüm özellik modüllerini (auth, interview, admin, llm, users
// vb.) bir araya getiren ana montaj dosyası. Ortam değişkeni doğrulamasını,
// IP başına genel hız sınırını ve CSRF (Origin) korumasını uygulama
// genelinde burada devreye sokar.
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { ThrottlerModule, seconds } from '@nestjs/throttler';
import { GlobalThrottleGuard } from './common/guards/global-throttle.guard';
import { createThrottlerStorage } from './common/throttler-storage';
import { LlmQuotaRefundInterceptor } from './common/llm-quota-refund.interceptor';
import { OriginGuard } from './common/guards/origin.guard';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { LlmModule } from './llm/llm.module';
import { InterviewModule } from './interview/interview.module';
import { PreAssessmentModule } from './pre-assessment/pre-assessment.module';
import { AdminModule } from './admin/admin.module';
import { UsersModule } from './users/users.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    // docs/SECURITY.md S3: LLM disi uc noktalarin HICBIRINDE siklik siniri yoktu
    // (/api/admin/stats cagri basina dort agregasyon kosar). Buradaki `default`
    // kovasi kaba bir emniyet freni: IP basina, tum rotalarda, asagidaki
    // APP_GUARD ile uygulanir. Ince ayar hedefe ozel sinirlarda kalir
    // (llmQuota, rate-limit.config.ts) - bu kova onlarin yerine gecmez.
    //
    // ThrottlerModule @Global()'dir: tek forRoot tum modullere yeter.
    // Onceden interview.module.ts'te ayri bir forRoot vardi; ikinci bir global
    // kayit ayni token'lari yeniden baglar ve hangi yapilandirmanin kazandigi
    // belirsizlesir, bu yuzden kayit TEK yerde toplandi.
    //
    // ONEMLI: ThrottlerGuard.canActivate yapilandirilmis TUM kovalari gezer ve
    // her biri icin rotadaki @Throttle metadata'sini okur. Bu yuzden kovalar
    // guard'lara acikca bolunmustur: GlobalThrottleGuard yalnizca `default`,
    // LlmRateLimitGuard yalnizca `llm` isler. Boyle olmasaydi global guard,
    // LLM uc noktalarindaki @Throttle(llmQuota(3)) degerini kendi IP izleyicisiyle
    // uygular ve kullanici basina olmasi gereken kotayi IP basina cevirirdi.
    //
    // SAYAC DEPOSU (S1): `REDIS_URL` verilmisse sayaclar Redis'te tutulur ve
    // uygulama ORNEKLERI ARASINDA paylasilir; verilmemisse kutuphanenin
    // surec-ici bellegi kullanilir. Karar tek yerde: common/throttler-storage.ts.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          { name: 'default', ttl: seconds(60), limit: 300 },
          // Yer tutucu: her LLM uc noktasi @Throttle(llmQuota(N)) ile KENDI
          // limitini verir (3/60/5 per saat — docs/API_CONVENTIONS.md 3.5).
          { name: 'llm', ttl: seconds(3600), limit: 1000 },
        ],
        storage: createThrottlerStorage(config.get<string>('REDIS_URL')),
      }),
    }),
    PrismaModule,
    AuthModule,
    LlmModule,
    InterviewModule,
    PreAssessmentModule,
    AdminModule,
    UsersModule,
  ],
  providers: [
    // Tum rotalarda IP basina `default` kovasi. Isimli kovalar (llm) bu guard
    // tarafindan DEGERLENDIRILMEZ — bkz. global-throttle.guard.ts.
    { provide: APP_GUARD, useClass: GlobalThrottleGuard },
    // CSRF: state degistiren isteklerde Origin dogrulamasi (docs/SECURITY.md S5).
    // Cerez sameSite'i gevsetilse bile ozel uclar korumali kalir.
    { provide: APP_GUARD, useClass: OriginGuard },
    // Saglayici cokerse kullanicinin harcanan LLM kotasini geri verir.
    //
    // NEDEN GLOBAL, neden uc nokta basina @UseInterceptors DEGIL: iade
    // yalnizca istekte guard'in biraktigi sayac anahtari varsa calisir, yani
    // kotasiz uclarda kendiliginden etkisizdir. Global kayit ayrica YENI bir
    // LLM ucu eklendiginde unutulmasini imkansiz kilar.
    //
    // NEDEN main.ts'te useGlobalInterceptors DEGIL: bootstrap yalnizca uretim
    // yolunda calisir; entegrasyon testleri uygulamayi createNestApplication()
    // ile kurar ve orada devreye hic girmezdi (ayni gerekce: asagidaki helmet
    // middleware'i).
    { provide: APP_INTERCEPTOR, useClass: LlmQuotaRefundInterceptor },
  ],
})
export class AppModule implements NestModule {
  // docs/SECURITY.md S6: guvenlik basliklari.
  //
  // NEDEN main.ts'te app.use() DEGIL: bootstrap() yalnizca uretim yolunda
  // calisir; entegrasyon testleri uygulamayi createNestApplication() ile kurar
  // ve orada main.ts'teki middleware'ler HIC devreye girmez. Modul middleware'i
  // olarak baglandiginda iki yol da AYNI yapilandirmayi kullanir ve basliklarin
  // varligi testle dogrulanabilir hale gelir.
  //
  // CSP bilincli olarak KAPALI: bu surec yalnizca JSON dondurur, HTML servis
  // etmez; CSP'nin koruyacagi bir belge yoktur. Frontend'in CSP'si kendi statik
  // sunucusunun sorumlulugundadir.
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(helmet({ contentSecurityPolicy: false })).forRoutes('*');
  }
}
