import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { HttpExceptionFilter } from '../../../src/common/http-exception.filter';
import { LLM_PROVIDER } from '../../../src/llm/llm.provider';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { FakeLlmProvider } from '../../fakes/fake-llm.provider';

// US1..US4 (002-interview) entegrasyon testleri icin paylasilan kurulum.
// LLM_PROVIDER portu FakeLlmProvider ile override edilir — gercek saglayiciya
// istek atan test YAZILMAZ (plan.md, quickstart.md On Kosullar).
export interface InterviewTestApp {
  app: INestApplication;
  prisma: PrismaService;
  fakeLlm: FakeLlmProvider;
}

export async function createInterviewTestApp(): Promise<InterviewTestApp> {
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
