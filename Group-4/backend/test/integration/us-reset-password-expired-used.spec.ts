import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import * as mailer from '../../src/auth/mail/verification-mailer';

// 006-sifre-sifirlama US3 / FR-009, SC-004: suresi dolmus, daha once
// kullanilmis veya hic var olmamis token -> reddedilir.
//
// Bu dosya SADECE DOGRULAMA amaclidir (tasks.md T018): davranis Better Auth'un
// native `consumeVerificationValue` + `expiresAt` kontrolunden gelir, ek kod
// yazilmamistir. Test kirmizilasirsa Better Auth surumunde regresyon var demektir.
describe('POST /api/auth/reset-password (gecersiz/suresi dolmus token)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `us-reset-expired-${Date.now()}@example.com`;
  const sifre = 'Parola12';
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
      .send({ email, password: sifre, name: 'Reset Expired' });
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

  async function yeniTokenAl(): Promise<string> {
    token = '';
    await request(app.getHttpServer())
      .post('/api/auth/request-password-reset')
      .send({ email, redirectTo: 'http://localhost:5173/reset-password' });
    expect(token).not.toBe('');
    return token;
  }

  it('(a) suresi dolmus token -> 400, sifre DEGISMEZ', async () => {
    const t = await yeniTokenAl();
    // expiresAt'i gecmise cek (1 saatlik sureyi beklemeden simule et).
    await prisma.verification.updateMany({
      where: { identifier: `reset-password:${t}` },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ newPassword: 'BaskaParola78', token: t });
    expect(res.status).toBe(400);

    const giris = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password: sifre });
    expect(giris.status).toBe(200);
  });

  it('(b) daha once kullanilmis token -> 400', async () => {
    const t = await yeniTokenAl();

    const ilk = await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ newPassword: 'IlkParola90', token: t });
    expect(ilk.status).toBe(200);

    const ikinci = await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ newPassword: 'IkinciParola91', token: t });
    expect(ikinci.status).toBe(400);

    // Ikinci istek sifreyi degistirmedi.
    const giris = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password: 'IlkParola90' });
    expect(giris.status).toBe(200);
  });

  it('(c) hic var olmamis token -> 400, ayrinti sizdirmayan genel hata', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({
        newPassword: 'RastgeleParola92',
        token: 'hic-var-olmayan-token',
      });

    expect(res.status).toBe(400);
    // FR-009: token'in neden gecersiz oldugu (yok mu, suresi mi dolmus) sizmaz.
    const govde = JSON.stringify(res.body).toLowerCase();
    expect(govde).not.toContain('expired');
    expect(govde).not.toContain('not found');
  });
});
