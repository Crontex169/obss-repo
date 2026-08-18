import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { seedAdmin } from '../../prisma/seed';

// Hikaye 4 kriter 1 / FR-018: seed admin, e-posta/sifre ile giris -> role=admin oturum.
describe('Admin seed + giris (US4)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `us4-admin-${Date.now()}@example.com`;
  const password = 'AdminParola1';

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    process.env.ADMIN_EMAIL = email;
    process.env.ADMIN_PASSWORD = password;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('seed admin olusturur: role=admin, emailVerified=true', async () => {
    await seedAdmin(prisma);

    const user = await prisma.user.findUnique({
      where: { email },
      include: { accounts: true },
    });
    expect(user?.role).toBe('admin');
    expect(user?.emailVerified).toBe(true);
    expect(user?.accounts.some((a) => a.providerId === 'credential')).toBe(
      true,
    );
  });

  it('seed admin kimlikleriyle giris -> role=admin oturum baslar', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password });
    expect(res.status).toBe(200);

    const cookies = res.headers['set-cookie'];
    const sessionRes = await request(app.getHttpServer())
      .get('/api/auth/get-session')
      .set('Cookie', cookies);
    expect(sessionRes.body?.user?.role).toBe('admin');
  });

  it('seedAdmin tekrar calistirilir -> idempotent (mukerrer kullanici/hesap yok, FR-018)', async () => {
    await seedAdmin(prisma);
    await seedAdmin(prisma);

    const users = await prisma.user.findMany({ where: { email } });
    expect(users).toHaveLength(1);
    // `findMany` include'suz cagrildi: iliski YUKLENMEMIS olmali. Cast gerekli
    // cunku cikarilan tipte `accounts` alani zaten yok — iddia da tam olarak bu.
    expect((users[0] as { accounts?: unknown }).accounts).toBeUndefined();

    const accounts = await prisma.account.findMany({
      where: { user: { email } },
    });
    expect(accounts).toHaveLength(1);
  });
});
