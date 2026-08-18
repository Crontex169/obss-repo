import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  mockGoogleJwks,
  signFakeGoogleIdToken,
} from './helpers/google-id-token';

// Google One Tap (/api/auth/one-tap/callback). us3-google-cancel-admin.spec.ts
// ile ayni FR-006 kuralini kapsar: idToken govdesi burada DUZ string
// ({idToken: string}), sosyal giristeki ic ice {idToken:{token}} sekli DEGIL -
// bu yuzden ayri bir on-kontrol (rejectAdminGoogleOneTapSignIn) ve ayri test var.
describe('Google One Tap (/one-tap/callback)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const adminEmail = `one-tap-admin-${Date.now()}@example.com`;

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
    await prisma.user.deleteMany({
      where: { email: { in: [adminEmail] } },
    });
    await app.close();
  });

  it('admin e-postasiyla One Tap denemesi -> reddedilir (FR-006)', async () => {
    const idToken = await signFakeGoogleIdToken({ email: adminEmail });

    const res = await request(app.getHttpServer())
      .post('/api/auth/one-tap/callback')
      .send({ idToken });

    expect(res.status).toBe(403);
    expect((res.body as { code?: string }).code).toBe('ADMIN_GOOGLE_FORBIDDEN');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('normal kullanici One Tap ile oturum acar', async () => {
    const email = `one-tap-user-${Date.now()}@example.com`;
    const idToken = await signFakeGoogleIdToken({ email });

    const res = await request(app.getHttpServer())
      .post('/api/auth/one-tap/callback')
      .send({ idToken });

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeDefined();
    expect((res.body as { user: { email: string } }).user.email).toBe(email);

    await prisma.user.deleteMany({ where: { email } });
  });
});
