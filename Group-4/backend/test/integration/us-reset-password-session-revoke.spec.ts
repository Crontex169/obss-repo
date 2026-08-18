import { Test, TestingModule } from '@nestjs/testing';
import {
  Controller,
  Get,
  INestApplication,
  Module,
  UseGuards,
} from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AuthModule } from '../../src/auth/auth.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SessionGuard } from '../../src/auth/guards/session.guard';
import * as mailer from '../../src/auth/mail/verification-mailer';

// Korumali test route'u (us5-session-guard.spec.ts ile ayni desen): oturumun
// gercekten gecersiz kilindigini 401 uzerinden dogrulamak icin.
@Controller('test-only/reset-revoke')
class RevokeProbeController {
  @UseGuards(SessionGuard)
  @Get()
  get() {
    return { ok: true };
  }
}

@Module({
  imports: [AuthModule],
  controllers: [RevokeProbeController],
})
class TestOnlyModule {}

// 006-sifre-sifirlama FR-008: basarili sifirlamadan sonra kullanicinin
// onceden acik TUM oturumlari sonlandirilir.
describe('POST /api/auth/reset-password (oturum sonlandirma)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `us-reset-revoke-${Date.now()}@example.com`;
  const eskiSifre = 'Parola12';
  const yeniSifre = 'YeniParola34';
  let token = '';
  let eskiCerez: string[] = [];

  beforeAll(async () => {
    jest.spyOn(mailer, 'sendVerificationEmail').mockResolvedValue();
    jest
      .spyOn(mailer, 'sendPasswordResetEmail')
      .mockImplementation((_email, url) => {
        token = new URL(url).pathname.split('/').pop() ?? '';
        return Promise.resolve();
      });

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule, TestOnlyModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ email, password: eskiSifre, name: 'Reset Revoke' });
    await prisma.user.update({
      where: { email },
      data: { emailVerified: true },
    });

    const giris = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password: eskiSifre });
    eskiCerez = giris.headers['set-cookie'] as unknown as string[];

    await request(app.getHttpServer())
      .post('/api/auth/request-password-reset')
      .send({ email, redirectTo: 'http://localhost:5173/reset-password' });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
    jest.restoreAllMocks();
  });

  it('sifirlama oncesi oturum calisiyor, sifirlama sonrasi 401', async () => {
    expect(eskiCerez).toBeDefined();
    const once = await request(app.getHttpServer())
      .get('/test-only/reset-revoke')
      .set('Cookie', eskiCerez);
    expect(once.status).toBe(200);

    const sifirla = await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ newPassword: yeniSifre, token });
    expect(sifirla.status).toBe(200);

    const sonra = await request(app.getHttpServer())
      .get('/test-only/reset-revoke')
      .set('Cookie', eskiCerez);
    expect(sonra.status).toBe(401);

    // DB tarafinda da oturum kalmadi.
    const user = await prisma.user.findUnique({ where: { email } });
    const sessions = await prisma.session.findMany({
      where: { userId: user!.id },
    });
    expect(sessions).toHaveLength(0);
  });
});
