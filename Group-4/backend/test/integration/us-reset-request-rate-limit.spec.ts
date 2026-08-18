import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import * as mailer from '../../src/auth/mail/verification-mailer';

// 006-sifre-sifirlama FR-007 / SC-005: e-posta basina saatte en fazla 3 istek;
// 4. istek 429 ile reddedilir (mevcut giris-denemesi sayacindan bagimsiz sayac).
describe('POST /api/auth/request-password-reset (istek siklik siniri)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `us-reset-rl-${Date.now()}@example.com`;
  const otherEmail = `us-reset-rl-diger-${Date.now()}@example.com`;
  const password = 'Parola12';

  beforeAll(async () => {
    jest.spyOn(mailer, 'sendVerificationEmail').mockResolvedValue();
    jest.spyOn(mailer, 'sendPasswordResetEmail').mockResolvedValue(undefined);
    jest
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
      .send({ email, password, name: 'Reset RL' });
    await prisma.user.update({
      where: { email },
      data: { emailVerified: true },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
    jest.restoreAllMocks();
  });

  const istek = (hedef: string) =>
    request(app.getHttpServer()).post('/api/auth/request-password-reset').send({
      email: hedef,
      redirectTo: 'http://localhost:5173/reset-password',
    });

  it('ilk 3 istek 200, 4. istek 429', async () => {
    const statusler: number[] = [];
    for (let i = 0; i < 4; i++) {
      statusler.push((await istek(email)).status);
    }

    expect(statusler.slice(0, 3)).toEqual([200, 200, 200]);
    expect(statusler[3]).toBe(429);
  });

  it('sinir e-posta basinadir: baska e-posta ayni pencerede engellenmez', async () => {
    const res = await istek(otherEmail);
    expect(res.status).toBe(200);
  });
});
