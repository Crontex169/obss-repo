import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import * as mailer from '../../src/auth/mail/verification-mailer';

// 006-sifre-sifirlama US1 Senaryo 2 / FR-002, FR-003, SC-003:
// kayitsiz e-posta -> kayitli hesapla BIREBIR AYNI 200 yanit, hicbir mail yok.
describe('POST /api/auth/request-password-reset (enumeration korumasi)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const registeredEmail = `us-reset-enum-var-${Date.now()}@example.com`;
  const unknownEmail = `us-reset-enum-yok-${Date.now()}@example.com`;
  const password = 'Parola12';
  let resetSpy: jest.SpyInstance;
  let googleNoticeSpy: jest.SpyInstance;

  beforeAll(async () => {
    jest.spyOn(mailer, 'sendVerificationEmail').mockResolvedValue();
    resetSpy = jest
      .spyOn(mailer, 'sendPasswordResetEmail')
      .mockResolvedValue(undefined);
    googleNoticeSpy = jest
      .spyOn(mailer, 'sendGoogleOnlyResetNoticeEmail')
      .mockResolvedValue(undefined);

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ email: registeredEmail, password, name: 'Reset Enum' });
    await prisma.user.update({
      where: { email: registeredEmail },
      data: { emailVerified: true },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: registeredEmail } });
    await app.close();
    jest.restoreAllMocks();
  });

  it('kayitsiz e-posta -> kayitli ile ayni 200 yanit, mail GONDERILMEZ', async () => {
    const kayitli = await request(app.getHttpServer())
      .post('/api/auth/request-password-reset')
      .send({
        email: registeredEmail,
        redirectTo: 'http://localhost:5173/reset-password',
      });

    resetSpy.mockClear();
    googleNoticeSpy.mockClear();

    const kayitsiz = await request(app.getHttpServer())
      .post('/api/auth/request-password-reset')
      .send({
        email: unknownEmail,
        redirectTo: 'http://localhost:5173/reset-password',
      });

    expect(kayitsiz.status).toBe(kayitli.status);
    expect(kayitsiz.status).toBe(200);
    expect(kayitsiz.body).toEqual(kayitli.body);

    expect(resetSpy).not.toHaveBeenCalled();
    expect(googleNoticeSpy).not.toHaveBeenCalled();
  });

  it('US1 Senaryo 4: bicimsel olarak gecersiz e-posta -> 400 dogrulama hatasi', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/request-password-reset')
      .send({
        email: 'gecersiz-eposta',
        redirectTo: 'http://localhost:5173/reset-password',
      });

    expect(res.status).toBe(400);
  });
});
