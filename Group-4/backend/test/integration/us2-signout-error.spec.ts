import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import * as mailer from '../../src/auth/mail/verification-mailer';

// Hikaye 2 kriter 2,3: sign-out sonrasi oturum geçersiz; yanlis sifre -> 401 genel mesaj
describe('Cikis + genel hata (US2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `us2-signout-${Date.now()}@example.com`;
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
      .send({ email, password, name: 'US2 Signout' });
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

  it('sign-out sonrasi oturum artik gecerli degil', async () => {
    const signInRes = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password });
    const cookies = signInRes.headers['set-cookie'];

    const signOutRes = await request(app.getHttpServer())
      .post('/api/auth/sign-out')
      .set('Cookie', cookies);
    expect([200, 204]).toContain(signOutRes.status);

    const sessionRes = await request(app.getHttpServer())
      .get('/api/auth/get-session')
      .set('Cookie', cookies);
    expect(sessionRes.body).toBeNull();
  });

  it('yanlis sifre -> 401 genel mesaj (alan sizdirmaz)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password: 'YanlisSifre1' });
    expect(res.status).toBe(401);
    const bodyStr = JSON.stringify(res.body).toLowerCase();
    // alan sizdirmama: "kullanici bulunamadi" gibi hesap-varligi ifsa eden mesaj olmamali
    expect(bodyStr).not.toContain('user not found');
    expect(bodyStr).not.toContain('kullanici bulunamadi');
  });
});
