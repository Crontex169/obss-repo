import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  mockGoogleJwks,
  signFakeGoogleIdToken,
} from './helpers/google-id-token';

// Hikaye 3 kriter 5 (iptal/hata) ve kriter 6 (admin Google reddi, FR-006).
// (Playwright ile de eslenir — bkz. tasks.md T051, T061.)
describe('Google iptal/hata + admin reddi (US3)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const adminEmail = `us3-admin-google-${Date.now()}@example.com`;

  beforeAll(async () => {
    await mockGoogleJwks();
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.user.create({
      data: {
        email: adminEmail,
        role: 'admin',
        emailVerified: true,
        name: 'Admin',
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: adminEmail } });
    await app.close();
  });

  it('Google akisi iptal/hata -> oturum acmadan hata ile doner (kriter 5)', async () => {
    const start = await request(app.getHttpServer())
      .post('/api/auth/sign-in/social')
      .send({ provider: 'google' });

    expect(start.status).toBe(200);
    const body = start.body as { url: string };
    const state = new URL(body.url).searchParams.get('state');
    expect(state).toBeTruthy();
    const stateCookies = start.headers['set-cookie'] ?? [];

    const callback = await request(app.getHttpServer())
      .get('/api/auth/callback/google')
      .query({ state, error: 'access_denied' })
      .set('Cookie', stateCookies);

    expect(callback.status).toBeGreaterThanOrEqual(300);
    expect(callback.status).toBeLessThan(400);
    expect(callback.headers.location).toContain('error=access_denied');
    // gecici 'state' cookie'si temizlenir; oturum (session) cookie'si SET edilmez
    const setCookies = String(callback.headers['set-cookie'] ?? '');
    expect(setCookies.includes('session')).toBe(false);
  });

  it('admin e-postasiyla Google denemesi -> reddedilir (kriter 6, FR-006)', async () => {
    const idToken = await signFakeGoogleIdToken({ email: adminEmail });

    const res = await request(app.getHttpServer())
      .post('/api/auth/sign-in/social')
      .send({ provider: 'google', idToken: { token: idToken } });

    expect(res.status).toBe(403);
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});
