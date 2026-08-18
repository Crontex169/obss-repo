import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import * as mailer from '../../src/auth/mail/verification-mailer';

// 006-sifre-sifirlama US2 Senaryo 3 / FR-006: politika (min 8 + harf + rakam)
// sifirlama ucunda da uygulanir; ret durumunda token GECERSIZ KILINMAZ.
// Not: Better Auth'un native kontrolu yalnizca uzunluk bakar (password.mjs),
// harf+rakam kontrolu hooks.before ile eklenir.
describe('POST /api/auth/reset-password (sifre politikasi)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `us-reset-pw-policy-${Date.now()}@example.com`;
  const eskiSifre = 'Parola12';
  let token = '';

  beforeAll(async () => {
    jest.spyOn(mailer, 'sendVerificationEmail').mockResolvedValue();
    jest
      .spyOn(mailer, 'sendPasswordResetEmail')
      .mockImplementation((_email, url) => {
        token = new URL(url).pathname.split('/').pop() ?? '';
        return Promise.resolve();
      });

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ email, password: eskiSifre, name: 'Reset PW Policy' });
    await prisma.user.update({
      where: { email },
      data: { emailVerified: true },
    });

    await request(app.getHttpServer())
      .post('/api/auth/request-password-reset')
      .send({ email, redirectTo: 'http://localhost:5173/reset-password' });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
    jest.restoreAllMocks();
  });

  it.each([
    ['cok kisa', 'Ab1'],
    ['rakamsiz', 'SadeceHarf'],
    ['harfsiz', '12345678'],
  ])('politika disi sifre (%s) -> 400, sifre DEGISMEZ', async (_ad, sifre) => {
    expect(token).not.toBe('');

    const res = await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ newPassword: sifre, token });
    expect(res.status).toBe(400);

    // Sifre degismedi: eski sifre hala calisiyor.
    const giris = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password: eskiSifre });
    expect(giris.status).toBe(200);
  });

  it('reddedilen denemelerden sonra ayni token HALA kullanilabilir', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ newPassword: 'GecerliParola9', token });
    expect(res.status).toBe(200);

    const giris = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password: 'GecerliParola9' });
    expect(giris.status).toBe(200);
  });
});
