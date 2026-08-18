import { Test, TestingModule } from '@nestjs/testing';
import {
  Controller,
  Get,
  INestApplication,
  Module,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import request from 'supertest';
import { setCookiesOf } from '../helpers/set-cookie';
import { AppModule } from '../../src/app.module';
import { AuthModule } from '../../src/auth/auth.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SessionGuard } from '../../src/auth/guards/session.guard';
import type { AuthUser } from '../../src/auth/decorators/current-user.decorator';
import * as mailer from '../../src/auth/mail/verification-mailer';

// Test-only kaynak: korunan icerige erisim, SessionGuard uzerinden dogrulanir
// (bkz. us5-session-guard.spec.ts, ayni kalip).
@Controller('test-only/protected-us6')
class ProtectedController {
  @UseGuards(SessionGuard)
  @Get()
  // SessionGuard `request.user`'a yazar; Express'in Request tipinde bu alan
  // yok — src/ tarafinda da her yerde ayni sekilde genisletiliyor.
  get(@Req() req: Request & { user?: AuthUser }) {
    return { ok: true, userId: req.user?.id };
  }
}

@Module({
  imports: [AuthModule],
  controllers: [ProtectedController],
})
class TestOnlyModule {}

// Hikaye 6 kriter 1 / FR-013: "Beni hatirla" ile giris -> 30 gun kalici cerez;
// donuste yeniden giris istenmez.
describe('"Beni hatirla" (US6)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `us6-remember-${Date.now()}@example.com`;
  const password = 'Parola12';

  beforeAll(async () => {
    jest.spyOn(mailer, 'sendVerificationEmail').mockResolvedValue();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule, TestOnlyModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ email, password, name: 'US6 Remember' });
    await prisma.user.update({
      where: { email },
      data: { emailVerified: true },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
    jest.restoreAllMocks();
  });

  it('rememberMe=true -> ~30 gun kalici cerez (Max-Age), oturum gecerli kalir', async () => {
    const signIn = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password, rememberMe: true });
    expect(signIn.status).toBe(200);

    const cookies: string[] = setCookiesOf(signIn);
    const sessionCookie = cookies.find((c) =>
      c.startsWith('better-auth.session_token='),
    );
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toMatch(/Max-Age=\d+/);
    const maxAge = Number(/Max-Age=(\d+)/.exec(sessionCookie!)?.[1]);
    expect(maxAge).toBeGreaterThan(29 * 24 * 60 * 60); // ~30 gun alt siniri

    const res = await request(app.getHttpServer())
      .get('/test-only/protected-us6')
      .set('Cookie', cookies);
    expect(res.status).toBe(200);
  });
});
