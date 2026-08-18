import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import * as mailer from '../../src/auth/mail/verification-mailer';
import {
  mockGoogleJwks,
  signFakeGoogleIdToken,
} from './helpers/google-id-token';

// 006-sifre-sifirlama US1 Senaryo 3 / FR-002, FR-003 (research.md Karar 3):
// yalnizca-Google hesap -> AYNI genel 200 yanit, ama gercek sifirlama linki
// YERINE "Google ile giris yapin" bilgilendirme maili gonderilir.
describe('POST /api/auth/request-password-reset (yalnizca-Google hesap)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `us-reset-google-${Date.now()}@example.com`;
  let resetSpy: jest.SpyInstance;
  let googleNoticeSpy: jest.SpyInstance;

  beforeAll(async () => {
    await mockGoogleJwks();
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

    // Yalnizca Google ile olusmus hesap (credential account YOK).
    const idToken = await signFakeGoogleIdToken({ email });
    await request(app.getHttpServer())
      .post('/api/auth/sign-in/social')
      .send({ provider: 'google', idToken: { token: idToken } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
    jest.restoreAllMocks();
  });

  it('yalnizca-Google hesap -> 200 genel mesaj, sifirlama linki YOK, bilgilendirme maili VAR', async () => {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { accounts: true },
    });
    // On kosul: hesap gercekten yalnizca-Google.
    expect(user!.accounts.some((a) => a.providerId === 'google')).toBe(true);
    expect(user!.accounts.some((a) => a.providerId === 'credential')).toBe(
      false,
    );

    resetSpy.mockClear();
    googleNoticeSpy.mockClear();

    const res = await request(app.getHttpServer())
      .post('/api/auth/request-password-reset')
      .send({ email, redirectTo: 'http://localhost:5173/reset-password' });

    expect(res.status).toBe(200);
    expect(resetSpy).not.toHaveBeenCalled();
    expect(googleNoticeSpy).toHaveBeenCalledTimes(1);
    expect(googleNoticeSpy.mock.calls[0][0]).toBe(email);
  });
});
