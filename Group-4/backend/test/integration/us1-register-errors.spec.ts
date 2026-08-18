import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

// Hikaye 1 kriter 2,3; Hikaye 3 kriter 3: mukerrer/gecersiz/zayif/yalnizca-Google
describe('POST /api/auth/sign-up/email (US1 sinir/hata)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const dupEmail = `us1-dup-${Date.now()}@example.com`;
  const googleOnlyEmail = `us1-googleonly-${Date.now()}@example.com`;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    // On kosul: mukerrer test icin bir kullanici onceden var
    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ email: dupEmail, password: 'Parola12', name: 'Dup' });

    // On kosul: yalnizca-Google hesabi (credential Account'u olmayan) simulasyonu
    const googleUser = await prisma.user.create({
      data: {
        email: googleOnlyEmail,
        emailVerified: true,
        role: 'user',
        accounts: {
          create: {
            providerId: 'google',
            accountId: `google-${Date.now()}`,
          },
        },
      },
    });
    void googleUser;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [dupEmail, googleOnlyEmail] } },
    });
    await app.close();
  });

  it('mukerrer e-posta -> 409 (detay sizdirmadan)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ email: dupEmail, password: 'Parola12', name: 'Dup2' });
    expect(res.status).toBe(409);
  });

  it('gecersiz e-posta -> 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ email: 'gecersiz-eposta', password: 'Parola12' });
    expect(res.status).toBe(400);
  });

  it('zayif sifre -> 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ email: `us1-weak-${Date.now()}@example.com`, password: '123' });
    expect(res.status).toBe(400);
  });

  it('yalnizca-Google e-postasi -> ACCOUNT_USE_GOOGLE reddi', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ email: googleOnlyEmail, password: 'Parola12' });
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).toContain('ACCOUNT_USE_GOOGLE');
  });
});
