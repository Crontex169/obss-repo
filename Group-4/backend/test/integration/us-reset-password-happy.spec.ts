import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import * as mailer from '../../src/auth/mail/verification-mailer';

// 006-sifre-sifirlama US2 Senaryo 1-2 / FR-005, FR-006, SC-006:
// gecerli token + politika-uyumlu sifre -> 200; eski sifre REDDEDILIR,
// yeni sifre ile giris BASARILI; token tekrar kullanilamaz.
describe('POST /api/auth/reset-password (US2 mutlu yol)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `us-reset-pw-happy-${Date.now()}@example.com`;
  const eskiSifre = 'Parola12';
  const yeniSifre = 'YeniParola34';
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
      .send({ email, password: eskiSifre, name: 'Reset PW Happy' });
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

  it('gecerli token + politika-uyumlu sifre -> 200; eski sifre redded, yeni sifre calisir', async () => {
    expect(token).not.toBe('');

    const res = await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ newPassword: yeniSifre, token });
    expect(res.status).toBe(200);

    const eskiIleGiris = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password: eskiSifre });
    expect(eskiIleGiris.status).toBeGreaterThanOrEqual(400);

    const yeniIleGiris = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password: yeniSifre });
    expect(yeniIleGiris.status).toBe(200);
  });

  it('FR-005: kullanilan token tekrar kullanilamaz', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ newPassword: 'BaskaParola56', token });
    expect(res.status).toBe(400);
  });
});
