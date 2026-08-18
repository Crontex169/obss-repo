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

// Test-only kaynak: korunan icerige erisim, SessionGuard uzerinden dogrulanir.
@Controller('test-only/protected-us6-expiry')
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

// Hikaye 6 kriter 2,3 / SC-006: rememberMe=false -> session-scoped cerez;
// suresi dolmus oturumla korunan icerik -> 401.
describe('Session-scoped + sure dolumu (US6)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `us6-expiry-${Date.now()}@example.com`;
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
      .send({ email, password, name: 'US6 Expiry' });
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

  it('rememberMe=false -> session-scoped cerez (Max-Age/Expires yok)', async () => {
    const signIn = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password, rememberMe: false });
    expect(signIn.status).toBe(200);

    const cookies: string[] = setCookiesOf(signIn);
    const sessionCookie = cookies.find((c) =>
      c.startsWith('better-auth.session_token='),
    );
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).not.toMatch(/Max-Age=\d+/);
    expect(sessionCookie).not.toMatch(/Expires=/);
  });

  it('suresi dolmus oturumla korunan icerik -> 401 (yeniden giris istenir)', async () => {
    const signIn = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password, rememberMe: true });
    const cookies: string[] = setCookiesOf(signIn);

    await prisma.session.updateMany({
      where: { user: { email } },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(app.getHttpServer())
      .get('/test-only/protected-us6-expiry')
      .set('Cookie', cookies);
    expect(res.status).toBe(401);
  });
});
