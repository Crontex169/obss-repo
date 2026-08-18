import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/http-exception.filter';

// T040 — Duman testi: InterviewModule koprusu ayakta mi?
// Oturumsuz istek 401; yabanci/yok kaynak 404 ve AYIRT EDILEMEZ; hata govdesi
// ortak zarf bicimindedir (docs/API_CONVENTIONS.md 1-2).
describe('InterviewModule (smoke)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('oturumsuz istek 401 doner (ortak zarf)', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/interviews/does-not-exist',
    );
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ statusCode: 401, error: 'Unauthorized' });
  });
});
