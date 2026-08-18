import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  mockGoogleJwks,
  signFakeGoogleIdToken,
} from './helpers/google-id-token';

// Hikaye 3 kriter 1 / SC-005: ilk Google girisi -> User(role="user",
// emailVerified=true) mukerrersiz olusturulur.
describe('Yeni Google kullanici (US3)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `us3-google-new-${Date.now()}@example.com`;

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
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('ilk Google girisinde role=user, emailVerified=true hesap acilir', async () => {
    const idToken = await signFakeGoogleIdToken({ email });

    const res = await request(app.getHttpServer())
      .post('/api/auth/sign-in/social')
      .send({ provider: 'google', idToken: { token: idToken } });

    expect(res.status).toBe(200);
    const body = res.body as {
      user: { email: string; role: string; emailVerified: boolean };
    };
    expect(body.user.email).toBe(email);
    expect(body.user.role).toBe('user');
    expect(body.user.emailVerified).toBe(true);

    const users = await prisma.user.findMany({
      where: { email },
      include: { accounts: true },
    });
    expect(users).toHaveLength(1);
    expect(users[0].accounts.some((a) => a.providerId === 'google')).toBe(true);
  });
});
