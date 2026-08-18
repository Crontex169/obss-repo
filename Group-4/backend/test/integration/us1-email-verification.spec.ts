import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import * as mailer from '../../src/auth/mail/verification-mailer';

// FR-019: dogrulamadan giris -> 403 EMAIL_NOT_VERIFIED; verify-email sonrasi basarili giris
describe('E-posta dogrulama akisi (US1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `us1-verify-${Date.now()}@example.com`;
  const password = 'Parola12';
  let capturedUrl = '';

  beforeAll(async () => {
    jest
      .spyOn(mailer, 'sendVerificationEmail')
      .mockImplementation(async (_email, url) => {
        capturedUrl = url;
      });

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ email, password, name: 'Verify Test' });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
    jest.restoreAllMocks();
  });

  it('dogrulanmamis kullanici girisi -> 403 EMAIL_NOT_VERIFIED', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password });
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).toContain('EMAIL_NOT_VERIFIED');
  });

  it('verify-email sonrasi emailVerified=true ve giris basarili', async () => {
    expect(capturedUrl).not.toBe('');
    // Mail linki frontend'in /verify-email sayfasina gider (T027); o sayfa token'i okuyup
    // authClient.verifyEmail ile backend'in /api/auth/verify-email ucunu cagirir - burada
    // ayni cagriyi taklit ediyoruz.
    const token = new URL(capturedUrl).searchParams.get('token');
    expect(token).toBeTruthy();

    const verifyRes = await request(app.getHttpServer())
      .get('/api/auth/verify-email')
      .query({ token });
    expect([200, 302]).toContain(verifyRes.status);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.emailVerified).toBe(true);

    const signInRes = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password });
    expect(signInRes.status).toBe(200);
  });
});
