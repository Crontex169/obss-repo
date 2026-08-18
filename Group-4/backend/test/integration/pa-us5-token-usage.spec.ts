import request from 'supertest';
import {
  createPreAssessmentTestApp,
  type PreAssessmentTestApp,
} from './helpers/pa-app';
import { registerAndSignIn } from './helpers/auth-session';
import {
  fakeCompetencyReport,
  validCreateBody,
} from './helpers/fake-competency-report';

// Hikaye 5: bu dilimin LLM cagrilari dogru operation/preAssessmentId ile
// devralinan TokenUsageService uzerinden kaydedilir (T059/T060/T062/T063).
//
// T061 (yazim hatasi kullanici akisini bozmaz) burada TEKRARLANMAZ: bu davranis
// TokenUsageService.record()'un kendi try/catch'inde, tamamen devralinan/paylasilan
// kodda yasiyor ve zaten backend/test/unit/token-usage.spec.ts'te genel olarak
// kanitlanmis (Faz 10/11 desenindeki "sahiplik baska dilimde" kuraliyla ayni ruh).
describe('US5 — token ve maliyet kaydi', () => {
  let ctx: PreAssessmentTestApp;
  const email = `pa-us5-${Date.now()}@example.com`;
  let cookies: string[];
  let userId: string;

  beforeAll(async () => {
    ctx = await createPreAssessmentTestApp();
    cookies = await registerAndSignIn(ctx.app, ctx.prisma, email);
    userId = (await ctx.prisma.user.findUniqueOrThrow({ where: { email } })).id;
  });

  afterAll(async () => {
    await ctx.prisma.preAssessment.deleteMany({ where: { user: { email } } });
    await ctx.prisma.user.deleteMany({ where: { email } });
    await ctx.app.close();
  });

  it('T059/SC-006: basarili uretim -> TokenUsage operation=pre_assessment, preAssessmentId dolu, succeeded=true, token>0', async () => {
    ctx.fakeLlm.always({
      content: fakeCompetencyReport(),
      inputTokens: 214,
      outputTokens: 742,
    });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody());
    expect(res.status).toBe(201);

    const usage = await ctx.prisma.tokenUsage.findFirst({
      where: { preAssessmentId: res.body.id },
    });
    expect(usage).not.toBeNull();
    expect(usage?.operation).toBe('pre_assessment');
    expect(usage?.userId).toBe(userId);
    expect(usage?.succeeded).toBe(true);
    expect(usage?.inputTokens).toBe(214);
    expect(usage?.outputTokens).toBe(742);
  });

  it('T060/H5-2: basarisiz uretim -> TokenUsage yine yazilir, succeeded=false', async () => {
    ctx.fakeLlm.always({ error: new Error('provider down') });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody());
    expect(res.status).toBe(502);

    const failedRecord = await ctx.prisma.preAssessment.findFirst({
      where: { userId, status: 'failed' },
      orderBy: { createdAt: 'desc' },
    });
    const usage = await ctx.prisma.tokenUsage.findFirst({
      where: { preAssessmentId: failedRecord!.id },
    });
    expect(usage).not.toBeNull();
    expect(usage?.succeeded).toBe(false);
    expect(usage?.operation).toBe('pre_assessment');
  });

  it('T062: 201 govdesinde token/maliyet alani YOK (kullaniciya kapali)', async () => {
    ctx.fakeLlm.always({ content: fakeCompetencyReport() });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody());

    expect(res.status).toBe(201);
    const asText = JSON.stringify(res.body);
    expect(asText).not.toContain('inputTokens');
    expect(asText).not.toContain('outputTokens');
    expect(asText).not.toContain('estimatedCostUsd');
  });

  it('T063/ADR-0007 (fiyat notu): groq (fake varsayilani) icin maliyet liste fiyatindan hesaplanir, tokenlar kaydedilir', async () => {
    ctx.fakeLlm.always({
      content: fakeCompetencyReport(),
      inputTokens: 100,
      outputTokens: 250,
    });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody());

    const usage = await ctx.prisma.tokenUsage.findFirst({
      where: { preAssessmentId: res.body.id },
    });
    expect(usage?.provider).toBe('groq');
    // (100*0.15 + 250*0.75) / 1_000_000 = 0.0002025 USD (6 haneye yuvarlanir).
    expect(Number(usage?.estimatedCostUsd)).toBeGreaterThan(0);
    expect(Number(usage?.estimatedCostUsd)).toBeCloseTo(0.0002025, 5);
    expect(usage?.inputTokens).toBe(100);
    expect(usage?.outputTokens).toBe(250);
  });
});
