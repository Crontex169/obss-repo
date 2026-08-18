import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { registerAndSignIn } from './helpers/auth-session';

// Dashboard KVKK onay popup'i: ilk girişte kvkkConsentAt=null döner, kabul
// edilince işaretlenir ve idempotenttir (ilk onay tarihi ezilmez).
describe('KVKK onayi (api/users/me)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `kvkk-consent-${Date.now()}@example.com`;

  beforeAll(async () => {
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

  it('oturum yok -> 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('yeni kullanicida kvkkConsentAt null doner', async () => {
    const cookies = await registerAndSignIn(app, prisma, email);

    const res = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.kvkkConsentAt).toBeNull();
  });

  it('onay verilince kvkkConsentAt dolar, tekrar cagrilinca tarih degismez', async () => {
    const cookies = await registerAndSignIn(app, prisma, `2-${email}`);

    const first = await request(app.getHttpServer())
      .post('/api/users/me/kvkk-consent')
      .set('Cookie', cookies);
    expect(first.status).toBe(201);
    expect(first.body.kvkkConsentAt).not.toBeNull();

    const second = await request(app.getHttpServer())
      .post('/api/users/me/kvkk-consent')
      .set('Cookie', cookies);
    expect(second.status).toBe(201);
    expect(second.body.kvkkConsentAt).toBe(first.body.kvkkConsentAt);

    await prisma.user.deleteMany({ where: { email: `2-${email}` } });
  });
});
