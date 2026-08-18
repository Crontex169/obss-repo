import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { HttpExceptionFilter } from '../../../src/common/http-exception.filter';
import { LLM_PROVIDER } from '../../../src/llm/llm.provider';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { FakeLlmProvider } from '../../fakes/fake-llm.provider';
import { registerAndSignIn } from './auth-session';

// 003-pre-assessment entegrasyon testleri icin paylasilan kurulum — ayni desen
// interview-app.ts (002-interview): LLM_PROVIDER portu FakeLlmProvider ile
// override edilir, gercek saglayiciya istek atan test YAZILMAZ.
export interface PreAssessmentTestApp {
  app: INestApplication;
  prisma: PrismaService;
  fakeLlm: FakeLlmProvider;
}

// ⚠️ KOTA TUZAGI: LlmRateLimitGuard 5/saat/kullanici, TUM POST cagrilarini
// (400/502 dahil - guard pipe'tan ONCE calisir) sayar. Bes'ten fazla POST yapan
// bir test dosyasi tek kullaniciyla kendi kendine 429'a carpar ve asil senaryoyu
// test edemez. Bu yardimci her senaryoya TAZE kullanici verir.
export async function freshUser(
  ctx: PreAssessmentTestApp,
  tag: string,
): Promise<{ email: string; cookies: string[] }> {
  const email = `pa-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const cookies = await registerAndSignIn(ctx.app, ctx.prisma, email);
  return { email, cookies };
}

export async function createPreAssessmentTestApp(): Promise<PreAssessmentTestApp> {
  const fakeLlm = new FakeLlmProvider();

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(LLM_PROVIDER)
    .useValue(fakeLlm)
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();

  return { app, prisma: app.get(PrismaService), fakeLlm };
}
