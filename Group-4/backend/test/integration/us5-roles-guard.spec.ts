import { Test, TestingModule } from '@nestjs/testing';
import {
  Controller,
  Get,
  INestApplication,
  Module,
  UseGuards,
} from '@nestjs/common';
import request from 'supertest';
import { setCookiesOf } from '../helpers/set-cookie';
import { AppModule } from '../../src/app.module';
import { AuthModule } from '../../src/auth/auth.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SessionGuard } from '../../src/auth/guards/session.guard';
import { RolesGuard } from '../../src/auth/guards/roles.guard';
import { Roles } from '../../src/auth/decorators/roles.decorator';
import * as mailer from '../../src/auth/mail/verification-mailer';

// Test-only kaynak: RolesGuard'in @Roles('admin') ile korunan bir uc noktayi
// dogru sekilde reddettigini/izin verdigini dogrulamak icin (bkz. authz-rules.md R1).
@Controller('test-only/admin-only')
class AdminOnlyController {
  @Roles('admin')
  @UseGuards(SessionGuard, RolesGuard)
  @Get()
  get() {
    return { ok: true };
  }
}

@Module({
  imports: [AuthModule],
  controllers: [AdminOnlyController],
})
class TestOnlyModule {}

// FR-008, Hikaye 5 kriter uzerinden R1: rol yetersiz -> 403 (contracts/authz-rules.md)
describe('RolesGuard (US5)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const userEmail = `us5-roles-user-${Date.now()}@example.com`;
  const adminEmail = `us5-roles-admin-${Date.now()}@example.com`;
  const password = 'Parola12';
  let userCookies: string[];
  let adminCookies: string[];

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
      .send({ email: userEmail, password, name: 'US5 Roles User' });
    await prisma.user.update({
      where: { email: userEmail },
      data: { emailVerified: true },
    });
    const userSignIn = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email: userEmail, password });
    userCookies = setCookiesOf(userSignIn);

    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ email: adminEmail, password, name: 'US5 Roles Admin' });
    await prisma.user.update({
      where: { email: adminEmail },
      data: { emailVerified: true, role: 'admin' },
    });
    const adminSignIn = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email: adminEmail, password });
    adminCookies = setCookiesOf(adminSignIn);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [userEmail, adminEmail] } },
    });
    await app.close();
    jest.restoreAllMocks();
  });

  it('user rolu @Roles("admin") uc noktasina erisir -> 403', async () => {
    const res = await request(app.getHttpServer())
      .get('/test-only/admin-only')
      .set('Cookie', userCookies);
    expect(res.status).toBe(403);
  });

  it('admin rolu @Roles("admin") uc noktasina erisir -> 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/test-only/admin-only')
      .set('Cookie', adminCookies);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
