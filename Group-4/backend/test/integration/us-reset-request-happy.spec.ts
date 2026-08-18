import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import * as mailer from '../../src/auth/mail/verification-mailer';

// 006-sifre-sifirlama US1 Senaryo 1 / FR-001, FR-003, FR-004, FR-010, FR-013:
// parola hesapli kayitli kullanici -> 200 genel mesaj + gercek sifirlama linki maili.
describe('POST /api/auth/request-password-reset (US1 mutlu yol)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `us-reset-happy-${Date.now()}@example.com`;
  const password = 'Parola12';
  let resetSpy: jest.SpyInstance;

  beforeAll(async () => {
    jest.spyOn(mailer, 'sendVerificationEmail').mockResolvedValue();
    resetSpy = jest
      .spyOn(mailer, 'sendPasswordResetEmail')
      .mockResolvedValue(undefined);

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ email, password, name: 'Reset Happy' });
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

  it('kayitli parola hesabi -> 200 genel mesaj + sifirlama maili gonderilir', async () => {
    resetSpy.mockClear();

    const res = await request(app.getHttpServer())
      .post('/api/auth/request-password-reset')
      .send({ email, redirectTo: 'http://localhost:5173/reset-password' });

    expect(res.status).toBe(200);
    // FR-013: yanit token'i / linki ASLA icermez.
    expect(JSON.stringify(res.body)).not.toContain('reset-password:');

    expect(resetSpy).toHaveBeenCalledTimes(1);
    const [mailedTo, url] = resetSpy.mock.calls[0] as [string, string];
    expect(mailedTo).toBe(email);
    expect(url).toContain('/reset-password/');
  });

  it('FR-004/FR-010: token Verification tablosuna 1 saatlik sure ile yazilir', async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    const records = await prisma.verification.findMany({
      where: { value: user!.id, identifier: { startsWith: 'reset-password:' } },
    });

    expect(records).toHaveLength(1);
    const ttlMs =
      records[0].expiresAt.getTime() - records[0].createdAt.getTime();
    // 1 saat (+/- 60 sn tolerans)
    expect(Math.abs(ttlMs - 3600_000)).toBeLessThan(60_000);
  });

  it('FR-011: yeni istek onceki bekleyen token(lar)i gecersiz kilar', async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    const before = await prisma.verification.findMany({
      where: { value: user!.id, identifier: { startsWith: 'reset-password:' } },
    });
    expect(before.length).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .post('/api/auth/request-password-reset')
      .send({ email, redirectTo: 'http://localhost:5173/reset-password' });

    const after = await prisma.verification.findMany({
      where: { value: user!.id, identifier: { startsWith: 'reset-password:' } },
    });
    expect(after).toHaveLength(1);
    expect(after[0].identifier).not.toBe(before[0].identifier);
  });
});
