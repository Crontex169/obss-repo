import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import * as mailer from '../../src/auth/mail/verification-mailer';

// FR-016: sifre asla duz metin saklanmaz. T065 kod incelemesi yerine dogrudan
// kanit: kayit sonrasi Account.password DB'de okunur ve hash oldugu dogrulanir.
describe('FR-016 sifre duz metin saklanmaz', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `fr016-hash-${Date.now()}@example.com`;
  const password = 'Parola12';

  beforeAll(async () => {
    jest.spyOn(mailer, 'sendVerificationEmail').mockResolvedValue();

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

  it('kayit sonrasi Account.password hash olarak saklanir', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ email, password, name: 'Hash Testi' });
    expect([200, 201]).toContain(res.status);

    const account = await prisma.account.findFirst({
      where: { user: { email }, providerId: 'credential' },
    });
    expect(account?.password).toBeTruthy();
    const stored = account!.password!;

    expect(stored).not.toBe(password);
    expect(stored).not.toContain(password);
    // scrypt (better-auth varsayilani) "salt:key" hex, bcrypt "$2b$", argon2 "$argon2".
    expect(stored).toMatch(
      /^([a-f0-9]{16,}:[a-f0-9]{32,}|\$2[aby]\$|\$argon2)/,
    );
  });

  it('kontrol grubu: User kaydinda sifre alani hic tutulmaz', async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    expect(JSON.stringify(user)).not.toContain(password);
  });
});
