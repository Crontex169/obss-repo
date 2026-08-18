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
import { AppModule } from '../../src/app.module';
import { AuthModule } from '../../src/auth/auth.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SessionGuard } from '../../src/auth/guards/session.guard';
import * as mailer from '../../src/auth/mail/verification-mailer';

// Test-only kaynak: SessionGuard'in request.user'i doldurdugunu dogrulamak icin
// gecici bir korumali route (gercek kaynak bu dilimde yok, bkz. authz-rules.md).
@Controller('test-only/protected')
class ProtectedController {
  @UseGuards(SessionGuard)
  @Get()
  get(
    @Req()
    req: Request & { user?: { id: string; email: string; role: string } },
  ) {
    return { userId: req.user?.id, role: req.user?.role };
  }
}

@Module({
  imports: [AuthModule],
  controllers: [ProtectedController],
})
class TestOnlyModule {}

// Hikaye 5 kriter 4 / R4: oturum yok/gecersiz -> 401 (contracts/authz-rules.md)
describe('SessionGuard (US5)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `us5-session-${Date.now()}@example.com`;
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
      .send({ email, password, name: 'US5 Session' });
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

  it('oturum cerezi yok -> 401', async () => {
    const res = await request(app.getHttpServer()).get('/test-only/protected');
    expect(res.status).toBe(401);
  });

  it('gecersiz oturum cerezi -> 401', async () => {
    const res = await request(app.getHttpServer())
      .get('/test-only/protected')
      .set('Cookie', 'better-auth.session_token=gecersiz-token');
    expect(res.status).toBe(401);
  });

  it('gecerli oturum -> 200, request.user doldurulur', async () => {
    const signIn = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password });
    const cookies = signIn.headers['set-cookie'];

    const res = await request(app.getHttpServer())
      .get('/test-only/protected')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('user');
    expect(typeof res.body.userId).toBe('string');
  });
});
