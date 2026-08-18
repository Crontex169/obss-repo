import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import * as mailer from '../../src/auth/mail/verification-mailer';

// Hikaye 2 kriter 1: dogru kimlikle giris -> 200 + oturum cerezi; oturum kullanilabilir
// (Not: SessionGuard/korumali route henuz yok - US5'te eklenecek. Bu asamada "erisim"
// Better Auth'un kendi get-session uc noktasi ile dogrulaniyor - bkz. devlog karar notu.)
describe('POST /api/auth/sign-in/email (US2 mutlu yol)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `us2-happy-${Date.now()}@example.com`;
  const password = 'Parola12';

  beforeAll(async () => {
    jest.spyOn(mailer, 'sendVerificationEmail').mockResolvedValue();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ email, password, name: 'US2 Happy' });
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

  it('dogru kimlik -> 200, oturum cerezi set edilir, oturum kullanilabilir', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password });

    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();

    const sessionRes = await request(app.getHttpServer())
      .get('/api/auth/get-session')
      .set('Cookie', cookies);
    expect(sessionRes.status).toBe(200);
    expect(sessionRes.body?.user?.email).toBe(email);
  });
});
