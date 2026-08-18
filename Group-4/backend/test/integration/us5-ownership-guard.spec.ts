import { Test, TestingModule } from '@nestjs/testing';
import {
  Controller,
  Get,
  INestApplication,
  Module,
  Param,
  UseGuards,
} from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AuthModule } from '../../src/auth/auth.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SessionGuard } from '../../src/auth/guards/session.guard';
import { OwnershipGuard } from '../../src/auth/ownership/ownership.guard';
import * as mailer from '../../src/auth/mail/verification-mailer';

// Test-only kaynak: gercek bir kaynak (gorusme/rapor) bu dilimde henuz yok.
// OwnershipGuard sozlesmesi ":ownerId" route param'ini request.user.id ile
// karsilastirir; sonraki dilimler gercek kaynaklara bu sozlesmeyle baglanir
// (bkz. authz-rules.md, research.md §5).
@Controller('test-only/resource')
class ResourceController {
  @UseGuards(SessionGuard, OwnershipGuard)
  @Get(':ownerId')
  get(@Param('ownerId') ownerId: string) {
    return { ownerId };
  }
}

@Module({
  imports: [AuthModule],
  controllers: [ResourceController],
})
class TestOnlyModule {}

// Hikaye 5 kriter 1-3 / R2-R3: sahiplik yoksa 403 (sizdirmadan), kendi kaynagi izinli,
// admin okuma icin baypas (contracts/authz-rules.md).
describe('OwnershipGuard (US5)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const emailA = `us5-owner-a-${Date.now()}@example.com`;
  const emailB = `us5-owner-b-${Date.now()}@example.com`;
  const adminEmail = `us5-owner-admin-${Date.now()}@example.com`;
  const password = 'Parola12';
  let userAId: string;
  let cookiesA: string[];
  let cookiesB: string[];
  let cookiesAdmin: string[];

  async function registerAndSignIn(email: string, role?: 'admin') {
    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ email, password, name: email });
    await prisma.user.update({
      where: { email },
      data: { emailVerified: true, ...(role ? { role } : {}) },
    });
    const signIn = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password });
    return signIn.headers['set-cookie'] as unknown as string[];
  }

  beforeAll(async () => {
    jest.spyOn(mailer, 'sendVerificationEmail').mockResolvedValue();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule, TestOnlyModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    cookiesA = await registerAndSignIn(emailA);
    cookiesB = await registerAndSignIn(emailB);
    cookiesAdmin = await registerAndSignIn(adminEmail, 'admin');

    const userA = await prisma.user.findUniqueOrThrow({
      where: { email: emailA },
    });
    userAId = userA.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [emailA, emailB, adminEmail] } },
    });
    await app.close();
    jest.restoreAllMocks();
  });

  it('B, A nin kaynagina erisir -> 403 (sizdirmaz)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/test-only/resource/${userAId}`)
      .set('Cookie', cookiesB);
    expect(res.status).toBe(403);
    expect(res.body.ownerId).toBeUndefined();
  });

  it('A kendi kaynagina erisir -> 200', async () => {
    const res = await request(app.getHttpServer())
      .get(`/test-only/resource/${userAId}`)
      .set('Cookie', cookiesA);
    expect(res.status).toBe(200);
    expect(res.body.ownerId).toBe(userAId);
  });

  it('admin A nin kaynagini okur -> 200 (admin baypas)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/test-only/resource/${userAId}`)
      .set('Cookie', cookiesAdmin);
    expect(res.status).toBe(200);
    expect(res.body.ownerId).toBe(userAId);
  });
});
