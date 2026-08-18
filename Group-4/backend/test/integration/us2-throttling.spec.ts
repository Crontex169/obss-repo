import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import * as mailer from '../../src/auth/mail/verification-mailer';

// Hikaye 2 kriter 4, FR-017: ayni e-posta icin 10 basarisiz denemeden sonra 429;
// sabit sureli tam kilit UYGULANMAZ (mekanizma implementasyon detayidir, sadece
// disaridan gozlemlenen davranis test edilir).
describe('Giris throttling (US2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `us2-throttle-${Date.now()}@example.com`;
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
      .send({ email, password, name: 'US2 Throttle' });
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

  it('10 basarisiz denemeden sonra (11. istek) 429 doner', async () => {
    let lastStatus = 0;
    // Ilk 10 deneme basarisiz (401 beklenir), 11. deneme rate-limit'e takilmali (429).
    for (let i = 0; i < 11; i++) {
      const res = await request(app.getHttpServer())
        .post('/api/auth/sign-in/email')
        .send({ email, password: 'YanlisSifre1' });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
