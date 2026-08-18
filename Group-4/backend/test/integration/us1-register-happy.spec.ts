import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import * as mailer from '../../src/auth/mail/verification-mailer';

// Hikaye 1 kriter 1: gecerli e-posta + Parola12 ile kayit -> User(role=user, emailVerified=false)
describe('POST /api/auth/sign-up/email (US1 mutlu yol)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `us1-happy-${Date.now()}@example.com`;

  beforeAll(async () => {
    // T087(a): mailer'i mockla - MAIL_TRANSPORT=resend ile gercek e-posta gonderimini engelle
    jest.spyOn(mailer, 'sendVerificationEmail').mockResolvedValue();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('kayit sonrasi User role=user, emailVerified=false olusturur', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ email, password: 'Parola12', name: 'Test Kullanici' });

    expect([200, 201]).toContain(res.status);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    expect(user?.role).toBe('user');
    expect(user?.emailVerified).toBe(false);

    // T018: dogrulama e-postasi tetiklendi - gercek mail gonderimi yerine mock'a assert
    expect(mailer.sendVerificationEmail).toHaveBeenCalledWith(
      email,
      expect.stringContaining('/verify-email?token='),
    );
  });
});
