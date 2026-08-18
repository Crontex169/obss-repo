import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { setCookiesOf } from '../helpers/set-cookie';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import * as mailer from '../../src/auth/mail/verification-mailer';

// Degerlendirme kriteri 1 (Yetkilendirme, %6) + 11 (Guvenlik, %4)
// User story'ler: specs/degerlendirme-user-stories.md (DS-01, DS-02, DS-04)
// Bu dosya, mevcut us*-spec.ts dosyalarinin KAPSAMADIGI kesitleri test eder:
// rol yukseltme denemesi, yetkilendirme matrisi, cerez bayraklari, sizinti kontrolu.

jest.setTimeout(60_000);

describe('DS — Yetkilendirme ve guvenlik kesitleri', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const userEmail = `ds-user-${stamp}@example.com`;
  const adminEmail = `ds-admin-${stamp}@example.com`;
  const escalationEmail = `ds-escalation-${stamp}@example.com`;
  const dupEmail = `ds-dup-${stamp}@example.com`;
  const password = 'Parola12';

  const allEmails = [userEmail, adminEmail, escalationEmail, dupEmail];

  let userCookies: string[];
  let adminCookies: string[];

  async function kayitOl(email: string, extra: Record<string, unknown> = {}) {
    return request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ email, password, name: email, ...extra });
  }

  async function girisYap(email: string): Promise<string[]> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password });
    expect(res.status).toBe(200);
    return res.headers['set-cookie'] as unknown as string[];
  }

  beforeAll(async () => {
    jest.spyOn(mailer, 'sendVerificationEmail').mockResolvedValue(undefined);

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    await kayitOl(userEmail);
    await prisma.user.update({
      where: { email: userEmail },
      data: { emailVerified: true },
    });
    userCookies = await girisYap(userEmail);

    await kayitOl(adminEmail);
    await prisma.user.update({
      where: { email: adminEmail },
      data: { emailVerified: true, role: 'admin' },
    });
    adminCookies = await girisYap(adminEmail);

    await kayitOl(dupEmail);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: allEmails } } });
    await app.close();
    jest.restoreAllMocks();
  });

  // ------------------------------------------------------------------
  // DS-01 — Kullanici kayit/giris
  // ------------------------------------------------------------------
  describe('DS-01 — kullanici kayit ve giris', () => {
    it('DS-01-K1: istemci gövdede role="admin" gonderse bile hesap role="user" olur', async () => {
      const res = await kayitOl(escalationEmail, { role: 'admin' });
      expect([200, 201]).toContain(res.status);

      const user = await prisma.user.findUniqueOrThrow({
        where: { email: escalationEmail },
      });
      expect(user.role).toBe('user');
    });

    it('DS-01-K2: mukerrer kayit ikinci bir User satiri OLUSTURMAZ', async () => {
      const oncekiSayi = await prisma.user.count({
        where: { email: dupEmail },
      });
      expect(oncekiSayi).toBe(1);

      const res = await kayitOl(dupEmail);
      expect(res.status).toBe(409);

      const sonrakiSayi = await prisma.user.count({
        where: { email: dupEmail },
      });
      expect(sonrakiSayi).toBe(1);
    });

    it('DS-01-E2: "kullanici yok" ile "sifre yanlis" yanitlari AYIRT EDILEMEZ', async () => {
      const yanlisSifre = await request(app.getHttpServer())
        .post('/api/auth/sign-in/email')
        .send({ email: userEmail, password: 'TamamenYanlis9' });

      const olmayanKullanici = await request(app.getHttpServer())
        .post('/api/auth/sign-in/email')
        .send({
          email: `yok-${stamp}@example.com`,
          password: 'TamamenYanlis9',
        });

      expect(yanlisSifre.status).toBe(olmayanKullanici.status);
      expect(yanlisSifre.body.message).toBe(olmayanKullanici.body.message);
      expect(JSON.stringify(yanlisSifre.body)).not.toMatch(
        /not found|bulunamadi/i,
      );
    });
  });

  // ------------------------------------------------------------------
  // DS-02 — Admin ayrimi
  // ------------------------------------------------------------------
  describe('DS-02 — admin ayrimi', () => {
    it('DS-02-K1: admin ucu matrisi — oturumsuz 401, user 403, admin 200', async () => {
      const oturumsuz = await request(app.getHttpServer()).get(
        '/api/admin/ping',
      );
      const kullanici = await request(app.getHttpServer())
        .get('/api/admin/ping')
        .set('Cookie', userCookies);
      const admin = await request(app.getHttpServer())
        .get('/api/admin/ping')
        .set('Cookie', adminCookies);

      expect([oturumsuz.status, kullanici.status, admin.status]).toEqual([
        401, 403, 200,
      ]);
    });

    it('DS-02-K1b: 401 ile 403 birbirinden ayirt edilebilir (yanlis kod dondurulmuyor)', async () => {
      const oturumsuz = await request(app.getHttpServer()).get(
        '/api/admin/ping',
      );
      expect(oturumsuz.status).not.toBe(403);
    });
  });

  // ------------------------------------------------------------------
  // DS-04 — Guvenlik: sizinti ve cerez bayraklari
  // ------------------------------------------------------------------
  describe('DS-04 — guvenlik', () => {
    it('DS-04-H1: oturum cerezi HttpOnly ve SameSite tasir', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/sign-in/email')
        .send({ email: userEmail, password });

      const cookies: string[] = setCookiesOf(res);
      const sessionCookie = cookies.find((c) =>
        c.startsWith('better-auth.session_token='),
      );
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toMatch(/HttpOnly/i);
      expect(sessionCookie).toMatch(/SameSite/i);
    });

    it('DS-04-E1: get-session yaniti sifre/hash/salt SIZDIRMAZ', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/get-session')
        .set('Cookie', userCookies);

      expect(res.status).toBe(200);
      const govde = JSON.stringify(res.body).toLowerCase();
      expect(govde).not.toContain('password');
      expect(govde).not.toContain('"hash"');
      expect(govde).not.toContain('"salt"');
    });

    it('DS-04-E1b: yanit rol bilgisini tasir ama istemci ona GUVENILMEZ (sunucu DB den okur)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/get-session')
        .set('Cookie', userCookies);
      expect(res.body?.user?.role).toBe('user');

      // Istemci sahte bir rol basligi/gövdesi uydursa bile admin ucu reddeder
      const sahte = await request(app.getHttpServer())
        .get('/api/admin/ping')
        .set('Cookie', userCookies)
        .set('x-user-role', 'admin')
        .send({ role: 'admin' });
      expect(sahte.status).toBe(403);
    });

    it('DS-04-K1: hata govdesi stack trace / dosya yolu / SQL sizdirmaz', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/sign-up/email')
        .send({ email: 'gecersiz-eposta', password: '123' });

      expect(res.status).toBe(400);
      const govde = JSON.stringify(res.body);
      expect(govde).not.toMatch(/\bat\s+\w+\s+\(/); // stack frame
      expect(govde).not.toMatch(/[A-Za-z]:\\\\|\/home\/|\/usr\//); // dosya yolu
      expect(govde).not.toMatch(/SELECT |INSERT |prisma\./i); // SQL / ORM detayi
      expect(govde).not.toMatch(/node_modules/);
    });
  });
});
