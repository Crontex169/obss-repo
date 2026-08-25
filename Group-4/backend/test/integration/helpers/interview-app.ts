import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { HttpExceptionFilter } from '../../../src/common/http-exception.filter';
import { LLM_PROVIDER } from '../../../src/llm/llm.provider';
import { TRANSCRIPTION_PROVIDER } from '../../../src/transcription/transcription.provider';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { FakeLlmProvider } from '../../fakes/fake-llm.provider';
import { FakeTranscriptionProvider } from '../../fakes/fake-transcription.provider';

// US1..US4 (002-interview) entegrasyon testleri icin paylasilan kurulum.
// LLM_PROVIDER ve TRANSCRIPTION_PROVIDER portlari fake'lerle override edilir
// — gercek saglayiciya istek atan test YAZILMAZ (plan.md, quickstart.md On Kosullar).
export interface InterviewTestApp {
  app: INestApplication;
  prisma: PrismaService;
  fakeLlm: FakeLlmProvider;
  fakeTranscription: FakeTranscriptionProvider;
}

export async function createInterviewTestApp(): Promise<InterviewTestApp> {
  const fakeLlm = new FakeLlmProvider();
  const fakeTranscription = new FakeTranscriptionProvider();

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(LLM_PROVIDER)
    .useValue(fakeLlm)
    .overrideProvider(TRANSCRIPTION_PROVIDER)
    .useValue(fakeTranscription)
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();

  return { app, prisma: app.get(PrismaService), fakeLlm, fakeTranscription };
}
