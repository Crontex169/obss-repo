import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

// Duman testi: kopru ayakta mi? Bos oturumda get-session null/401 doner.
describe('GET /api/auth/get-session (smoke)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('bos oturumda null/401 doner (kopru ayakta)', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/get-session');
    expect([200, 401]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toBeNull();
    }
  });
});
