import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { registerAndSignIn } from './helpers/auth-session';

// DELETE /api/users/me — KVKK unutulma hakki (hesap silme).
// Kurallarin tamami SUNUCUDA dogrulanir (Ilke V): istemci kontrolu atlatilarak
// atilan dogrudan istek de ayni cevaplari alir.
describe('Hesap silme (DELETE /api/users/me)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const stamp = Date.now();
  const emails: string[] = [];

  function emailFor(label: string) {
    const email = `account-delete-${label}-${stamp}@example.com`;
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

  it('oturum yok -> 401', async () => {
    const res = await request(app.getHttpServer()).delete('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/users/me parolali hesapta hasPassword:true doner', async () => {
    const email = emailFor('has-password');
    const cookies = await registerAndSignIn(app, prisma, email);

    const res = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.hasPassword).toBe(true);
  });

  it('parolali hesapta sifre gonderilmezse 400, hesap durur', async () => {
    const email = emailFor('no-password-field');
    const cookies = await registerAndSignIn(app, prisma, email);

    const res = await request(app.getHttpServer())
      .delete('/api/users/me')
      .set('Cookie', cookies)
      .send({ confirm: true });

    expect(res.status).toBe(400);
    expect(await prisma.user.findUnique({ where: { email } })).not.toBeNull();
  });

  it('yanlis sifre -> 401, hesap durur', async () => {
    const email = emailFor('wrong-password');
    const cookies = await registerAndSignIn(app, prisma, email);

    const res = await request(app.getHttpServer())
      .delete('/api/users/me')
      .set('Cookie', cookies)
      .send({ password: 'YanlisParola9' });

    expect(res.status).toBe(401);
    expect(await prisma.user.findUnique({ where: { email } })).not.toBeNull();
  });

  it('admin rolu kendi hesabini silemez -> 403', async () => {
    const email = emailFor('admin');
    const cookies = await registerAndSignIn(app, prisma, email, 'admin');

    const res = await request(app.getHttpServer())
      .delete('/api/users/me')
      .set('Cookie', cookies)
      .send({ password: 'Parola12' });

    expect(res.status).toBe(403);
    expect(await prisma.user.findUnique({ where: { email } })).not.toBeNull();
  });

  it('dogru sifre -> 204; kullanici, hesap ve oturumlari tamamen silinir', async () => {
    const email = emailFor('happy');
    const cookies = await registerAndSignIn(app, prisma, email);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });

    const res = await request(app.getHttpServer())
      .delete('/api/users/me')
      .set('Cookie', cookies)
      .send({ password: 'Parola12' });

    expect(res.status).toBe(204);

    // Hard delete: kisisel veri (ad/e-posta) kalmaz, iliskili kayitlar cascade
    // ile duser — "silindi" isaretli bir golge kayit BIRAKILMAZ.
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    expect(await prisma.account.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);

    // Silinmis oturum cerezi artik hicbir kapiyi acmaz.
    const after = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', cookies);
    expect(after.status).toBe(401);
  });

  it('silinen kullanici ayni sifreyle tekrar giris yapamaz', async () => {
    const email = emailFor('resignin');
    const cookies = await registerAndSignIn(app, prisma, email);

    await request(app.getHttpServer())
      .delete('/api/users/me')
      .set('Cookie', cookies)
      .send({ password: 'Parola12' })
      .expect(204);

    const signIn = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password: 'Parola12' });

    expect(signIn.status).toBeGreaterThanOrEqual(400);
  });

  it('yalnizca-Google hesap: onaysiz istek 400, confirm:true ile 204', async () => {
    const email = emailFor('google-only');
    const cookies = await registerAndSignIn(app, prisma, email);
    // Kayit sirasinda olusan parola hesabi, "Google ile giris" senaryosunu
    // taklit etmek icin google saglayicisiyla degistirilir.
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.account.deleteMany({ where: { userId: user.id } });
    await prisma.account.create({
      data: {
        userId: user.id,
        providerId: 'google',
        accountId: `google-${stamp}`,
      },
    });

    const status = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', cookies);
    expect(status.body.hasPassword).toBe(false);

    const withoutConfirm = await request(app.getHttpServer())
      .delete('/api/users/me')
      .set('Cookie', cookies)
      .send({});
    expect(withoutConfirm.status).toBe(400);

    const confirmed = await request(app.getHttpServer())
      .delete('/api/users/me')
      .set('Cookie', cookies)
      .send({ confirm: true });
    expect(confirmed.status).toBe(204);
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });
});
