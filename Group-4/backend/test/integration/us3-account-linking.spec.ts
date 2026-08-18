import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  mockGoogleJwks,
  signFakeGoogleIdToken,
} from './helpers/google-id-token';

// Hikaye 3 kriter 2,3,4: e-posta/sifre <-> Google hesap baglama kurallari.
describe('Hesap baglama (US3)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const passwordFirstEmail = `us3-linking-pwfirst-${Date.now()}@example.com`;
  const googleFirstEmail = `us3-linking-googlefirst-${Date.now()}@example.com`;
  const unverifiedEmail = `us3-linking-unverified-${Date.now()}@example.com`;

  beforeAll(async () => {
    await mockGoogleJwks();
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: { in: [passwordFirstEmail, googleFirstEmail, unverifiedEmail] },
      },
    });
    await app.close();
  });

  it('once parola sonra Google (ayni e-posta) -> otomatik ayni hesaba baglanir (kriter 2,4)', async () => {
    await request(app.getHttpServer()).post('/api/auth/sign-up/email').send({
      email: passwordFirstEmail,
      password: 'Parola12',
      name: 'Test Kullanici',
    });
    await prisma.user.update({
      where: { email: passwordFirstEmail },
      data: { emailVerified: true },
    });

    const idToken = await signFakeGoogleIdToken({ email: passwordFirstEmail });
    const res = await request(app.getHttpServer())
      .post('/api/auth/sign-in/social')
      .send({ provider: 'google', idToken: { token: idToken } });

    expect(res.status).toBe(200);

    const users = await prisma.user.findMany({
      where: { email: passwordFirstEmail },
      include: { accounts: true },
    });
    expect(users).toHaveLength(1);
    const providerIds = users[0].accounts.map((a) => a.providerId).sort();
    expect(providerIds).toEqual(['credential', 'google']);
  });

  // Sahadan gelen hata (2026-08-05): kullanici Google ile girmeye calisinca
  // `account not linked` aliyordu. Sebep, yukaridaki mutlu yoldaki
  // `emailVerified: true` guncellemesinin gizledigi kosul: Better Auth,
  // trustedProviders'ta olsa bile YEREL hesap dogrulanmamissa baglamaz
  // (`accountLinking.requireLocalEmailVerified`, varsayilan true —
  // node_modules/better-auth/dist/oauth2/link-account.mjs).
  //
  // Bu KASITLI bir guvenlik kurali: dogrulanmamis bir kaydin sahibi kanitli
  // degildir. Biri kurbanin adresiyle parolali kayit acip beklerse, kural
  // olmadan kurbanin Google girisi saldirganin satirina baglanir ve saldirgan
  // parolayi bildigi icin hesabi devralir. Bu yuzden kural KAPATILMADI;
  // kullaniciya once dogrulama yolu gosteriliyor (pages/login.tsx).
  it('yerel hesap DOGRULANMAMISSA Google baglanmaz (account not linked)', async () => {
    await request(app.getHttpServer()).post('/api/auth/sign-up/email').send({
      email: unverifiedEmail,
      password: 'Parola12',
      name: 'Dogrulanmamis Kullanici',
    });
    // Kasitli olarak emailVerified GUNCELLENMEZ — mutlu yoldan tek fark budur.

    const idToken = await signFakeGoogleIdToken({ email: unverifiedEmail });
    const res = await request(app.getHttpServer())
      .post('/api/auth/sign-in/social')
      .send({ provider: 'google', idToken: { token: idToken } });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.body).toLowerCase()).toContain('not linked');

    const user = await prisma.user.findUnique({
      where: { email: unverifiedEmail },
      include: { accounts: true },
    });
    expect(user?.accounts.map((a) => a.providerId)).toEqual(['credential']);
  });

  it('once Google sonra parola kaydi (ayni e-posta) -> parola hesabi olusmaz (kriter 3)', async () => {
    const idToken = await signFakeGoogleIdToken({ email: googleFirstEmail });
    await request(app.getHttpServer())
      .post('/api/auth/sign-in/social')
      .send({ provider: 'google', idToken: { token: idToken } });

    const res = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({
        email: googleFirstEmail,
        password: 'Parola12',
        name: 'Test Kullanici',
      });

    expect(JSON.stringify(res.body)).toContain('ACCOUNT_USE_GOOGLE');

    const users = await prisma.user.findMany({
      where: { email: googleFirstEmail },
      include: { accounts: true },
    });
    expect(users).toHaveLength(1);
    expect(users[0].accounts.map((a) => a.providerId)).toEqual(['google']);
  });
});
