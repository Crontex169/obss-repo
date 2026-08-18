import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { seedAdmin } from '../../prisma/seed';
import * as mailer from '../../src/auth/mail/verification-mailer';

// Hikaye 4 kriter 2/3, SC-004: user rolu admin paneline erisir -> 403;
// hatali admin kimligi -> genel 401 (alan sizdirmaz).
describe('Admin paneli koruma (US4)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const adminEmail = `us4-guard-admin-${Date.now()}@example.com`;
  const adminPassword = 'AdminParola1';
  const userEmail = `us4-guard-user-${Date.now()}@example.com`;
  const userPassword = 'Parola12';

  beforeAll(async () => {
    jest.spyOn(mailer, 'sendVerificationEmail').mockResolvedValue();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    process.env.ADMIN_EMAIL = adminEmail;
    process.env.ADMIN_PASSWORD = adminPassword;
    await seedAdmin(prisma);

    await request(app.getHttpServer()).post('/api/auth/sign-up/email').send({
      email: userEmail,
      password: userPassword,
      name: 'US4 Guard User',
    });
    await prisma.user.update({
      where: { email: userEmail },
      data: { emailVerified: true },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [adminEmail, userEmail] } },
    });
    await app.close();
    jest.restoreAllMocks();
  });

  it('user rolu admin paneli uc noktasina erisir -> 403', async () => {
    const signIn = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email: userEmail, password: userPassword });

    const res = await request(app.getHttpServer())
      .get('/api/admin/ping')
      .set('Cookie', signIn.headers['set-cookie']);
    expect(res.status).toBe(403);
  });

  it('admin rolu admin paneli uc noktasina erisir -> 200', async () => {
    const signIn = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email: adminEmail, password: adminPassword });

    const res = await request(app.getHttpServer())
      .get('/api/admin/ping')
      .set('Cookie', signIn.headers['set-cookie']);
    expect(res.status).toBe(200);
  });

  it('hatali admin sifresi -> genel 401 (alan sizdirmaz)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email: adminEmail, password: 'YanlisSifre1' });
    expect(res.status).toBe(401);
  });

  it('oturumsuz istek admin paneline erisir -> 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/admin/ping');
    expect(res.status).toBe(401);
  });
});
