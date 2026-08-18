import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ACCOUNT_DELETE_THRESHOLD } from '../../src/auth/rate-limit.config';
import { createAuth } from '../../src/auth/better-auth.config';
import type { PrismaClient } from '@prisma/client';
import { registerAndSignIn } from './helpers/auth-session';

// docs/SECURITY.md bulgularinin regresyon testleri. Her blok bir bulgu
// numarasina baglidir; bulgu kapatilirken buraya bir test eklenir, boylece
// duzeltme ileride sessizce geri alinamaz.
describe('Guvenlik regresyonlari (docs/SECURITY.md)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const stamp = Date.now();
  const emails: string[] = [];

  function emailFor(label: string) {
    const email = `security-${label}-${stamp}@example.com`;
    emails.push(email);
    return email;
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  // -------------------------------------------------------------------------
  // S1 — tunel joker host'u kapaliyken Host basligi baseURL'i belirleyemez.
  //
  // Acikken saldirgan kendi *.trycloudflare.com tunelini acip Host basligini o
  // adrese ayarlayarak sifirlama baglantisini kendi alan adina yonlendirebilir;
  // kurban tikladiginda tek kullanimlik token sizar. Test ortaminda
  // ALLOW_TUNNEL_HOSTS tanimli degildir (varsayilan "false"), yani korumali hal
  // dogrulanir.
  // -------------------------------------------------------------------------
  describe('S1 — Host basligi ile baseURL zehirleme', () => {
    // Olculen sey baseURL'in Host basligindan cozulup cozulmedigidir. OAuth
    // kickoff'u bunun icin en dogrudan gozlem noktasidir: uretilen `redirect_uri`
    // baseURL'den kurulur ve yanitta acikca goruntur — mail tasiyicisindan
    // (console/resend) bagimsizdir, arka plan isine de dayanmaz.
    it('sahte Host, OAuth redirect_uri`sini saldirganin alan adina tasimaz', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/sign-in/social')
        .set('Host', 'saldirgan-abc.trycloudflare.com')
        .send({ provider: 'google', callbackURL: '/' });

      expect(res.status).toBe(200);
      const url = (res.body as { url?: string }).url;
      expect(typeof url).toBe('string');

      // Ayni deger, baseURL zehirlenseydi sifirlama/dogrulama e-postasindaki
      // baglantiyi da tasiyacak olan degerdir.
      expect(url).not.toContain('trycloudflare.com');
      expect(decodeURIComponent(url!)).toContain(
        process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
      );
    });
  });

  // -------------------------------------------------------------------------
  // S2 — hesap silme ucu parola dogrular ve yaniti ayirt edilebilirdir
  // (yanlis 401 / dogru 204). Sinir olmadan ele gecirilmis bir oturum cerezinde
  // sinirsiz parola tahminine acilir.
  // -------------------------------------------------------------------------
  describe('S2 — hesap silmede parola tahmin siniri', () => {
    it(`${ACCOUNT_DELETE_THRESHOLD} basarisiz denemeden sonra 429 doner, hesap durur`, async () => {
      const email = emailFor('delete-bruteforce');
      const cookies = await registerAndSignIn(app, prisma, email);

      for (let i = 0; i < ACCOUNT_DELETE_THRESHOLD; i += 1) {
        const res = await request(app.getHttpServer())
          .delete('/api/users/me')
          .set('Cookie', cookies)
          .send({ password: `YanlisParola${i}` });
        expect(res.status).toBe(401);
      }

      const blocked = await request(app.getHttpServer())
        .delete('/api/users/me')
        .set('Cookie', cookies)
        .send({ password: 'YanlisParola99' });

      expect(blocked.status).toBe(429);
      expect(blocked.body.details.retryAfterSeconds).toBeGreaterThan(0);

      // Sinir, DOGRU parolayi da kapsar: kilit acikken islem hic denenmez.
      const withCorrect = await request(app.getHttpServer())
        .delete('/api/users/me')
        .set('Cookie', cookies)
        .send({ password: 'Parola12' });
      expect(withCorrect.status).toBe(429);
      expect(await prisma.user.findUnique({ where: { email } })).not.toBeNull();
    });

    it('eksik govde (400) kotayi tuketmez', async () => {
      const email = emailFor('delete-badrequest');
      const cookies = await registerAndSignIn(app, prisma, email);

      for (let i = 0; i < ACCOUNT_DELETE_THRESHOLD + 2; i += 1) {
        const res = await request(app.getHttpServer())
          .delete('/api/users/me')
          .set('Cookie', cookies)
          .send({});
        expect(res.status).toBe(400);
      }

      // Sayac artmadigi icin dogru parola hala kabul edilir.
      const ok = await request(app.getHttpServer())
        .delete('/api/users/me')
        .set('Cookie', cookies)
        .send({ password: 'Parola12' });
      expect(ok.status).toBe(204);
    });
  });

  // -------------------------------------------------------------------------
  // S4 — boyut siniri multer katmaninda: govde tamamen bellege alinmadan kesilir.
  // Servis katmanindaki kontrol (PdfTooLargeError) yerinde durur; HTTP yolunda
  // artik ona ulasilmadan once multer devreye girer.
  // -------------------------------------------------------------------------
  describe('S4 — PDF yukleme boyut siniri', () => {
    // Sinirin hemen ustundeki dosya (10-11 MB) servise ulasip Turkce 400 alir —
    // o yol us1-create-validation.spec.ts'te dogrulanir. Burada olculen sey
    // COK BUYUK govdenin multer tarafindan, bellege alinmadan kesilmesidir.
    it('sert sinirin ustundeki dosya 413 ile reddedilir', async () => {
      const email = emailFor('upload-limit');
      const cookies = await registerAndSignIn(app, prisma, email);

      const maxSizeMb = Number(process.env.PDF_MAX_SIZE_MB ?? 10);
      const tooLarge = Buffer.alloc((maxSizeMb + 3) * 1024 * 1024, 0x41);

      const res = await request(app.getHttpServer())
        .post('/api/interviews')
        .set('Cookie', cookies)
        .field('jobPostingSource', 'pdf')
        .field('questionCount', '5')
        .field('mode', 'written')
        .attach('jobPostingFile', tooLarge, 'buyuk.pdf');

      expect(res.status).toBe(413);
    });
  });

  // -------------------------------------------------------------------------
  // S7 — kayit akisi UC ayirt edilebilir yanit uretir (409 ACCOUNT_EXISTS /
  // 403 ACCOUNT_USE_GOOGLE / basari), yani hesabin varligi ve saglayicisi
  // ogrenilebilir. Bu davranis BILINCLI bir urun kararidir (spec.md Hikaye 3
  // kriter 3, contracts/auth-api.md, DS-03-E1) ve korunur; sizinti KALDIRILMAK
  // yerine PAHALILASTIRILIR.
  //
  // Bu blok yapilandirmayi dogrular, calisma zamani sayacini degil: sayac
  // Better Auth'un sorumlulugunda ve varsayilan olarak yalnizca production'da
  // devrede (testler ayni IP'den yuzlerce kayit yapar). Dogrulanan sey kuralin
  // ileride sessizce dusurulemeyecegidir.
  // -------------------------------------------------------------------------
  describe('S7 — kayit ucu siklik siniri yapilandirmasi', () => {
    const auth = createAuth({} as PrismaClient);
    const rule = auth.options.rateLimit?.customRules?.['/sign-up/email'] as
      { window: number; max: number } | undefined;

    it('/sign-up/email icin saatte 40 denemelik ozel kural tanimlidir', () => {
      expect(rule).toBeDefined();
      expect(rule?.window).toBe(3600);
      expect(rule?.max).toBe(40);
    });

    it('enabled ACIKCA verilmez — Better Auth varsayilani (yalnizca production) korunur', () => {
      // Acikca true verilseydi test kosusu ve yerel gelistirme de sinirlanirdi.
      // Cast gerekli: yapilandirmada `enabled` hic verilmedigi icin cikarilan
      // tipte de yok — testin iddiasi zaten "verilmemis olmasi".
      expect(
        (auth.options.rateLimit as { enabled?: boolean } | undefined)?.enabled,
      ).toBeUndefined();
    });

    it('sizinti KASITLI olarak duruyor: kayitli e-posta ile kayit 4xx alir', async () => {
      const email = emailFor('signup-existing');
      await registerAndSignIn(app, prisma, email);

      const res = await request(app.getHttpServer())
        .post('/api/auth/sign-up/email')
        .send({ email, password: 'Parola12', name: email });

      // DS-03-E1 / auth-api.md sozlesmesi: kayit yolu ayrimi korur.
      // Degistirilirse burasi kirilir ve karar yeniden gozden gecirilir.
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  // -------------------------------------------------------------------------
  // S10 — dosya turu istemci beyanina degil ICERIGE gore dogrulanir.
  // Content-Type multipart part'indan gelir ve sahtelenebilir; sihirli bayt
  // kontrolu, PDF olmayan baytlarin ayristiriciya hic ulasmamasini saglar.
  // -------------------------------------------------------------------------
  describe('S10 — PDF icerik dogrulamasi', () => {
    it('application/pdf beyan eden ama PDF olmayan icerik reddedilir', async () => {
      const email = emailFor('pdf-magic');
      const cookies = await registerAndSignIn(app, prisma, email);

      const res = await request(app.getHttpServer())
        .post('/api/interviews')
        .set('Cookie', cookies)
        .field('jobPostingSource', 'pdf')
        .field('questionCount', '5')
        .field('mode', 'written')
        .field('level', 'junior')
        .attach(
          'jobPostingFile',
          Buffer.from('MZ\x90\x00 bu bir exe', 'utf-8'),
          {
            filename: 'ilan.pdf',
            contentType: 'application/pdf',
          },
        );

      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // S5 — CSRF. Ozel NestJS uclari cerezle kimlikleniyordu ve hicbir origin
  // kontrolu yoktu; koruma yalnizca Better Auth'un ORTUK sameSite=lax
  // varsayilanindan geliyordu. OriginGuard o korumayi acik ve cerez duruşundan
  // BAGIMSIZ hale getirir.
  // -------------------------------------------------------------------------
  describe('S5 — state degistiren isteklerde origin dogrulamasi', () => {
    it('yabanci Origin ile POST -> 403', async () => {
      const email = emailFor('csrf-post');
      const cookies = await registerAndSignIn(app, prisma, email);

      const res = await request(app.getHttpServer())
        .post('/api/users/me/kvkk-consent')
        .set('Cookie', cookies)
        .set('Origin', 'https://kotu-site.example')
        .send({});

      expect(res.status).toBe(403);
    });

    it('yabanci Origin ile DELETE -> 403 (hesap durur)', async () => {
      const email = emailFor('csrf-delete');
      const cookies = await registerAndSignIn(app, prisma, email);

      const res = await request(app.getHttpServer())
        .delete('/api/users/me')
        .set('Cookie', cookies)
        .set('Origin', 'https://kotu-site.example')
        .send({ password: 'Parola12' });

      expect(res.status).toBe(403);
      expect(await prisma.user.findUnique({ where: { email } })).not.toBeNull();
    });

    it('izin verilen Origin ile POST gecer', async () => {
      const email = emailFor('csrf-allowed');
      const cookies = await registerAndSignIn(app, prisma, email);

      const res = await request(app.getHttpServer())
        .post('/api/users/me/kvkk-consent')
        .set('Cookie', cookies)
        .set('Origin', process.env.FRONTEND_URL ?? 'http://localhost:5173')
        .send({});

      expect(res.status).toBeLessThan(400);
    });

    it('yabanci Origin ile GET engellenmez (state degistirmez)', async () => {
      const email = emailFor('csrf-get');
      const cookies = await registerAndSignIn(app, prisma, email);

      const res = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Cookie', cookies)
        .set('Origin', 'https://kotu-site.example');

      expect(res.status).toBe(200);
    });

    it('Origin basligi yoksa gecer (tarayici disi istemci)', async () => {
      const email = emailFor('csrf-no-origin');
      const cookies = await registerAndSignIn(app, prisma, email);

      // supertest Origin gondermez — mevcut tum entegrasyon testlerinin yolu
      // budur ve tarayici disi mesru istemcileri kirmamak icin bilincli olarak
      // serbest birakilmistir.
      const res = await request(app.getHttpServer())
        .post('/api/users/me/kvkk-consent')
        .set('Cookie', cookies)
        .send({});

      expect(res.status).toBeLessThan(400);
    });
  });

  // -------------------------------------------------------------------------
  // S6 — guvenlik basliklari. Modul middleware'i olarak baglandigi icin bu
  // test uretimle AYNI yolu olcer (main.ts'teki app.use() testte calismazdi).
  // -------------------------------------------------------------------------
  describe('S6 — guvenlik basliklari', () => {
    it('helmet basliklari yanitta bulunur', async () => {
      const res = await request(app.getHttpServer()).get('/api/users/me');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['referrer-policy']).toBeDefined();
      expect(res.headers['x-frame-options']).toBeDefined();
      // API yalnizca JSON dondurur; CSP bilincli olarak kapalidir.
      expect(res.headers['content-security-policy']).toBeUndefined();
      // Sunucu parmak izi helmet tarafindan kaldirilir.
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });
});
