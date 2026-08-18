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
import { setCookiesOf } from '../helpers/set-cookie';
import { AppModule } from '../../src/app.module';
import { AuthModule } from '../../src/auth/auth.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { OwnershipGuard } from '../../src/auth/ownership/ownership.guard';
import { validateEnv } from '../../src/config/env.validation';
import * as mailer from '../../src/auth/mail/verification-mailer';

// ANALIZ DOGRULAMA SUITE'I
// ------------------------
// Bu dosya bir inceleme oturumunda ileri surulen iddialari dogrulamak icin
// yazildi. Her test, SPEC/SOZLESMENIN GEREKTIRDIGI davranisi iddia eder:
//   - test GECERSE  -> iddia yanlis, kod zaten dogru davraniyor
//   - test KALIRSA  -> iddia dogrulandi, kod sozlesmeden sapiyor
// Bulgular giderildikce bu dosya bir regresyon suite'ine donusur.

jest.setTimeout(90_000);

// A3 icin: sadece OwnershipGuard takilmis kaynak (SessionGuard YOK).
// contracts/authz-rules.md "Oturum yok/gecersiz -> 401" diyor.
@Controller('test-only/ownership-solo')
class OwnershipSoloController {
  @UseGuards(OwnershipGuard)
  @Get(':ownerId')
  get(@Param('ownerId') ownerId: string) {
    return { ownerId };
  }
}

@Module({
  imports: [AuthModule],
  controllers: [OwnershipSoloController],
})
class DogrulamaModule {}

describe('Analiz dogrulama', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const googleOnlyEmail = `dogrulama-googleonly-${stamp}@example.com`;
  const slidingEmail = `dogrulama-sliding-${stamp}@example.com`;
  const throttleEmail = `dogrulama-throttle-${stamp}@example.com`;
  const resetEmail = `dogrulama-reset-${stamp}@example.com`;
  const password = 'Parola12';

  const allEmails = [googleOnlyEmail, slidingEmail, throttleEmail, resetEmail];

  async function kayitVeDogrula(email: string) {
    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ email, password, name: email });
    await prisma.user.update({
      where: { email },
      data: { emailVerified: true },
    });
  }

  beforeAll(async () => {
    // Yalnizca yan etkisi icin: gercek mail gonderimi susturulur, spy'in
    // kendisi hicbir yerde okunmuyordu.
    jest.spyOn(mailer, 'sendVerificationEmail').mockResolvedValue(undefined);

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule, DogrulamaModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    // Yalnizca-Google hesabi: credential Account'u YOK (us1-register-errors deseni)
    await prisma.user.create({
      data: {
        email: googleOnlyEmail,
        emailVerified: true,
        role: 'user',
        accounts: {
          create: {
            providerId: 'google',
            accountId: `google-${stamp}`,
          },
        },
      },
    });

    await kayitVeDogrula(slidingEmail);
    await kayitVeDogrula(throttleEmail);
    await kayitVeDogrula(resetEmail);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: allEmails } } });
    await app.close();
    jest.restoreAllMocks();
  });

  // --------------------------------------------------------------------
  // A1 (COZULDU, bulgu T073 karari): spec Hikaye 3 kriter 3 artik yalnizca
  // KAYIT (sign-up) denemesini kapsiyor. GIRIS (sign-in) denemesinde ozel
  // ACCOUNT_USE_GOOGLE mesaji GOSTERILMEZ — FR-014/SC-007 (hesap
  // numaralandirma / var/yok sizdirmama) guvenlik tarafi kilitlendi.
  // --------------------------------------------------------------------
  describe('A1 - yalnizca-Google e-postasiyla GIRIS (cozuldu: guvenlik tarafi)', () => {
    it('sozlesme: kayit yolunda ACCOUNT_USE_GOOGLE donuyor (kontrol grubu)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/sign-up/email')
        .send({ email: googleOnlyEmail, password });

      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).toContain('ACCOUNT_USE_GOOGLE');
    });

    it('sozlesme: GIRIS yolunda ACCOUNT_USE_GOOGLE SIZDIRILMAZ, genel 401 doner (FR-014/SC-007)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/sign-in/email')
        .send({ email: googleOnlyEmail, password });

      expect(res.status).toBe(401);
      expect(JSON.stringify(res.body)).not.toContain('ACCOUNT_USE_GOOGLE');
    });
  });

  // --------------------------------------------------------------------
  // A2 - FR-013: "Beni hatirla" ile oturum 30 GUN gecerli; "Ayri bir
  // hareketsizlik (idle) zaman asimi UYGULANMAZ".
  // Iddia: Better Auth varsayilan session.updateAge (1 gun) yuzunden
  // expiresAt her aktivitede ileri kayiyor (sliding) -> sabit omur yok.
  // --------------------------------------------------------------------
  describe('A2 - oturum omru sabit mi, kayan mi', () => {
    it('FR-013: aktivite oturumun expiresAt degerini UZATMAMALI', async () => {
      const signIn = await request(app.getHttpServer())
        .post('/api/auth/sign-in/email')
        .send({ email: slidingEmail, password, rememberMe: true });
      expect(signIn.status).toBe(200);
      const cookies: string[] = setCookiesOf(signIn);

      // Oturumun 2 gun once acilmis gibi gorunmesini sagla:
      // expiresAt = now + 28 gun  (30 gunluk omrun 2 gunu gecmis)
      const iki_gun_gecmis = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);
      await prisma.session.updateMany({
        where: { user: { email: slidingEmail } },
        data: { expiresAt: iki_gun_gecmis },
      });

      const oncesi = await prisma.session.findFirstOrThrow({
        where: { user: { email: slidingEmail } },
      });

      // Tek bir normal istek (aktivite)
      const oturum = await request(app.getHttpServer())
        .get('/api/auth/get-session')
        .set('Cookie', cookies);
      expect(oturum.status).toBe(200);

      const sonrasi = await prisma.session.findFirstOrThrow({
        where: { user: { email: slidingEmail } },
      });

      const farkDakika =
        (sonrasi.expiresAt.getTime() - oncesi.expiresAt.getTime()) / 60000;

      console.log(
        `[A2] expiresAt oncesi=${oncesi.expiresAt.toISOString()} sonrasi=${sonrasi.expiresAt.toISOString()} fark=${farkDakika.toFixed(1)} dk`,
      );

      expect(sonrasi.expiresAt.getTime()).toBe(oncesi.expiresAt.getTime());
    });
  });

  // --------------------------------------------------------------------
  // A3 - contracts/authz-rules.md hata tablosu: "Oturum yok/gecersiz -> 401"
  // Iddia: OwnershipGuard request.user yoksa ForbiddenException (403) atiyor.
  // --------------------------------------------------------------------
  describe('A3 - OwnershipGuard oturumsuz istek', () => {
    it('sozlesme: oturumsuz istek 401 donmeli (403 degil)', async () => {
      const res = await request(app.getHttpServer()).get(
        '/test-only/ownership-solo/herhangi-bir-id',
      );

      console.log(`[A3] gozlemlenen status=${res.status}`);
      expect(res.status).toBe(401);
    });
  });

  // --------------------------------------------------------------------
  // A4 - GIDERILDI (006-sifre-sifirlama).
  //
  // Eski iddia: `sendResetPassword` bos fonksiyondu; /request-password-reset
  // 200 + "check your email" donuyor ama hicbir mail gitmiyordu (sessiz
  // basarisizlik). O donemki karar "ucu kapat" idi (001-auth-rol T077).
  //
  // Artik gecersiz: uc GERCEKTEN calisiyor ve mail gonderiyor. Bu blok, o
  // bulgunun geri gelmedigini dogrulayan bir regresyon testine donusturuldu.
  // Akisin tam kapsami us-reset-*.spec.ts dosyalarinda (US1/US2/US3).
  // --------------------------------------------------------------------
  describe('A4 - sifre sifirlama ucu (regresyon)', () => {
    let resetMailSpy: jest.SpyInstance;

    beforeAll(() => {
      resetMailSpy = jest
        .spyOn(mailer, 'sendPasswordResetEmail')
        .mockResolvedValue(undefined);
    });

    it('200 donuyorsa mail de GERCEKTEN gidiyor (sessiz basarisizlik yok)', async () => {
      resetMailSpy.mockClear();

      const res = await request(app.getHttpServer())
        .post('/api/auth/request-password-reset')
        .send({
          email: resetEmail,
          redirectTo: 'http://localhost:5173/reset-password',
        });

      expect(res.status).toBe(200);
      expect(resetMailSpy).toHaveBeenCalledTimes(1);
      const [mailedTo, url] = resetMailSpy.mock.calls[0] as [string, string];
      expect(mailedTo).toBe(resetEmail);
      expect(url).toContain('/reset-password/');
    });

    it('FR-013: sifirlama linki API yanitinda ifsa EDILMEZ', async () => {
      resetMailSpy.mockClear();

      const res = await request(app.getHttpServer())
        .post('/api/auth/request-password-reset')
        .send({
          email: resetEmail,
          redirectTo: 'http://localhost:5173/reset-password',
        });

      const [, url] = resetMailSpy.mock.calls[0] as [string, string];
      const token = new URL(url).pathname.split('/').pop() as string;
      expect(JSON.stringify(res.body)).not.toContain(token);
    });

    it('token olmadan /reset-password -> 400 (uc acik ama korumali)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({ newPassword: 'YeniParola12' });

      expect(res.status).toBe(400);
    });
  });

  // --------------------------------------------------------------------
  // F1 - FR-017: "10 basarisiz denemeden sonra CAPTCHA veya artan gecikme;
  // sabit sureli TAM HESAP KILIDI UYGULANMAZ".
  // Mevcut us2-throttling.spec.ts yalnizca 11. istegin 429 oldugunu
  // dogruluyor; esik ve "tam kilit yok" yari test edilmemis.
  // --------------------------------------------------------------------
  describe('F1 - throttling esigi ve tam kilit olmadigi', () => {
    it('ilk 10 deneme 401, 11. deneme 429; backoff sonrasi dogru sifre CALISIR', async () => {
      const statusler: number[] = [];
      for (let i = 0; i < 11; i++) {
        const res = await request(app.getHttpServer())
          .post('/api/auth/sign-in/email')
          .send({ email: throttleEmail, password: 'YanlisSifre1' });
        statusler.push(res.status);
      }

      console.log(`[F1] 11 denemenin statusleri: ${statusler.join(', ')}`);

      const ilkOn = statusler.slice(0, 10);
      expect(ilkOn.every((s) => s === 401)).toBe(true);
      expect(statusler[10]).toBe(429);

      // Artan gecikme sonrasi hesap KILITLI OLMAMALI (FR-017)
      await new Promise((r) => setTimeout(r, 6000));
      const dogruSifre = await request(app.getHttpServer())
        .post('/api/auth/sign-in/email')
        .send({ email: throttleEmail, password });

      console.log(
        `[F1] backoff sonrasi dogru sifre status=${dogruSifre.status}`,
      );
      expect(dogruSifre.status).toBe(200);
    });
  });

  // --------------------------------------------------------------------
  // A5 - env.validation.ts fail-fast amaci tasiyor ("eksik sir -> baslangicta
  // hata"). Iddia: MAIL_TRANSPORT=resend iken RESEND_API_KEY bos olsa bile
  // dogrulama geciyor -> production mail yolu calisma zamaninda kiriliyor.
  // (DB gerektirmez.)
  // --------------------------------------------------------------------
  describe('A5 - env dogrulamasi kosullu zorunluluk', () => {
    const gecerliTemel = {
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      BETTER_AUTH_SECRET: 'x'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:3000',
      FRONTEND_URL: 'http://localhost:5173',
      GOOGLE_CLIENT_ID: 'id',
      GOOGLE_CLIENT_SECRET: 'secret',
      ADMIN_EMAIL: 'admin@example.com',
      ADMIN_PASSWORD: 'Parola12',
    };

    it('MAIL_TRANSPORT=resend + bos RESEND_API_KEY -> baslangicta hata vermeli', () => {
      let hataMesaji: string | null = null;
      try {
        validateEnv({
          ...gecerliTemel,
          MAIL_TRANSPORT: 'resend',
          RESEND_API_KEY: '',
        });
      } catch (e) {
        hataMesaji = (e as Error).message;
      }

      console.log(
        `[A5] validateEnv sonucu: ${hataMesaji ?? 'HATA VERMEDI (gecti)'}`,
      );
      expect(hataMesaji).not.toBeNull();
    });

    it('kontrol grubu: eksik BETTER_AUTH_SECRET gercekten hata veriyor', () => {
      expect(() =>
        validateEnv({ ...gecerliTemel, BETTER_AUTH_SECRET: 'kisa' }),
      ).toThrow();
    });
  });
});
