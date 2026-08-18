import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { cleanupUsers, seedInterview } from './helpers/admin-scenario';

jest.setTimeout(60_000);

// 005-admin US3 / T031 — FR-009, FR-010, FR-011, SC-006.
//
// NOT: /api/admin/stats sistem geneli toplar ve entegrasyon veritabani test
// dosyalari arasinda PAYLASILIR. Bu yuzden burada, baska testlerin verisinden
// etkilenmeyen deterministik iddialar kurulur: bu senaryonun BENZERSIZ meslek
// kovasi tam sayiyla dogrulanir, geri kalan alanlar sozlesme/tutarlilik
// duzeyinde kontrol edilir. Metriklerin TAM aritmetigi (ortalama sure,
// tamamlanma orani, sifir doldurma) us-admin3-empty.spec.ts'te izole edilmis
// sahte veriyle birebir dogrulanir.
describe('US3-admin istatistikler', () => {
  let ctx: InterviewTestApp;
  const emails: string[] = [];
  let adminCookies: string[];

  const stamp = Date.now();
  const POSITION = `AdminTest-Stats-${stamp}`;

  beforeAll(async () => {
    ctx = await createInterviewTestApp();
    const adminEmail = `admin-stats-${stamp}@example.com`;
    const ownerAEmail = `owner-stats-a-${stamp}@example.com`;
    const ownerBEmail = `owner-stats-b-${stamp}@example.com`;
    emails.push(adminEmail, ownerAEmail, ownerBEmail);

    adminCookies = await registerAndSignIn(
      ctx.app,
      ctx.prisma,
      adminEmail,
      'admin',
    );
    await registerAndSignIn(ctx.app, ctx.prisma, ownerAEmail);
    await registerAndSignIn(ctx.app, ctx.prisma, ownerBEmail);

    const ownerA = await ctx.prisma.user.findUniqueOrThrow({
      where: { email: ownerAEmail },
    });
    const ownerB = await ctx.prisma.user.findUniqueOrThrow({
      where: { email: ownerBEmail },
    });

    // Ayni meslek kovasinda 4 kayit: 2 tamamlanmis, 1 yarim, 1 SILINMIS.
    // Silinmis kayit sayima DAHIL olmali (Clarifications Q1, FR-009).
    await seedInterview(ctx.prisma, ownerA.id, {
      position: POSITION,
      status: 'completed',
      durationSeconds: 600,
    });
    await seedInterview(ctx.prisma, ownerA.id, {
      position: POSITION,
      status: 'in_progress',
    });
    await seedInterview(ctx.prisma, ownerB.id, {
      position: POSITION,
      status: 'completed',
      durationSeconds: 900,
    });
    await seedInterview(ctx.prisma, ownerB.id, {
      position: POSITION,
      status: 'completed',
      durationSeconds: 300,
      deleted: true,
    });
  });

  afterAll(async () => {
    await cleanupUsers(ctx.prisma, emails);
    await ctx.app.close();
  });

  async function stats(query = '') {
    const res = await request(ctx.app.getHttpServer())
      .get(`/api/admin/stats${query}`)
      .set('Cookie', adminCookies);
    expect(res.status).toBe(200);
    return res.body as {
      countsByProfession: Array<{
        position: string | null;
        label: string;
        count: number;
      }>;
      averageDurationSeconds: number | null;
      completionRatio: { completed: number; inProgress: number };
      dailyTokenUsage: Array<{
        date: string;
        totalTokens: number;
        estimatedCostUsd: string;
      }>;
      totalCostUsd: string;
    };
  }

  it('meslek bazli sayi SILINMIS gorusmeleri de kapsar (FR-009, Clarifications Q1)', async () => {
    const body = await stats();
    const bucket = body.countsByProfession.find((c) => c.position === POSITION);
    expect(bucket).toBeDefined();
    // 4 kaydin tamami: 2 tamamlanmis + 1 yarim + 1 silinmis.
    expect(bucket!.count).toBe(4);
    expect(bucket!.label).toBe(POSITION);
  });

  it('position=null kovasi "Belirsiz" etiketiyle ayri gosterilir (research.md §3)', async () => {
    const body = await stats();
    const unspecified = body.countsByProfession.find(
      (c) => c.position === null,
    );
    if (unspecified) {
      expect(unspecified.label).toBe('Belirsiz');
    }
    // Etiketleme TEK kaynakta: hicbir kovada bos/undefined etiket olmamali.
    expect(body.countsByProfession.every((c) => Boolean(c.label))).toBe(true);
  });

  it('tamamlanma orani silinmisler dahil sayar (FR-011)', async () => {
    const body = await stats();
    // Bu senaryonun kendi katkisi: 3 tamamlanmis (biri SILINMIS) + 1 yarim.
    // Ust sinir paylasilan veritabanindan dolayi belirsizdir; TAM aritmetik
    // us-admin3-empty.spec.ts'te izole sahte veriyle dogrulanir (SC-006).
    expect(body.completionRatio.completed).toBeGreaterThanOrEqual(3);
    expect(body.completionRatio.inProgress).toBeGreaterThanOrEqual(1);
  });

  it('ortalama sure "aktif sure" olarak hesaplanir — bosluklar 5 dk ile kirpilir (FR-010)', async () => {
    const body = await stats();
    expect(body.averageDurationSeconds).not.toBeNull();
    expect(Number.isFinite(body.averageDurationSeconds!)).toBe(true);
    expect(body.averageDurationSeconds!).toBeGreaterThan(0);
  });

  it('meslek sayilari ile tamamlanma orani AYNI anlik goruntuden gelir (SC-006)', async () => {
    const body = await stats();
    // Sunucu dort sorguyu tek transaction'da okur; bu yuzden iki farkli
    // metrigin toplami birbirini TUTMAK ZORUNDADIR (eszamanli yazma olsa bile).
    const professionSum = body.countsByProfession.reduce(
      (s, c) => s + c.count,
      0,
    );
    expect(professionSum).toBe(
      body.completionRatio.completed + body.completionRatio.inProgress,
    );
  });
});
