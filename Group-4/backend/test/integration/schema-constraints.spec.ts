import { PrismaClient } from '@prisma/client';

// T014 — Sema kisit testi (002-interview veri katmani).
// Migration'in fiilen uyguladigi seyi dogrular; schema.prisma metnini degil.
// Calisan Postgres gerektirir (docker-compose).
describe('002-interview sema kisitlari', () => {
  const prisma = new PrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function columnsOf(table: string): Promise<string[]> {
    const rows = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table}
    `;
    return rows.map((r) => r.column_name);
  }

  async function indexDefsOf(table: string): Promise<string[]> {
    const rows = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = ${table}
    `;
    return rows.map((r) => r.indexdef);
  }

  it('Interview: admin/cross-cutting alanlari mevcut', async () => {
    const cols = await columnsOf('Interview');
    for (const c of [
      'position',
      'level',
      'language',
      'completedAt',
      'deletedAt',
    ]) {
      expect(cols).toContain(c);
    }
  });

  it('Interview: denormalize rollup alanlari YOK (API_CONVENTIONS 4.1)', async () => {
    const cols = await columnsOf('Interview');
    expect(cols).not.toContain('totalTokens');
    expect(cols).not.toContain('totalCostUsd');
  });

  it('Question: (interviewId, order) benzersiz', async () => {
    const defs = await indexDefsOf('Question');
    const unique = defs.filter((d) => d.includes('UNIQUE'));
    expect(
      unique.some((d) => d.includes('interviewId') && d.includes('order')),
    ).toBe(true);
  });

  it('Answer.questionId benzersiz — bir soruya en fazla bir cevap', async () => {
    const defs = await indexDefsOf('Answer');
    expect(
      defs.some((d) => d.includes('UNIQUE') && d.includes('questionId')),
    ).toBe(true);
  });

  it('Report.interviewId benzersiz — gorusme basina tek rapor', async () => {
    const defs = await indexDefsOf('Report');
    expect(
      defs.some((d) => d.includes('UNIQUE') && d.includes('interviewId')),
    ).toBe(true);
  });

  it('TokenUsage: admin istatistik index leri mevcut', async () => {
    const defs = await indexDefsOf('TokenUsage');
    expect(
      defs.some((d) => d.includes('userId') && d.includes('createdAt')),
    ).toBe(true);
    expect(
      defs.some((d) => d.includes('operation') && d.includes('createdAt')),
    ).toBe(true);
    expect(
      defs.some(
        (d) =>
          d.includes('interviewId') &&
          !d.includes('userId') &&
          !d.includes('operation'),
      ),
    ).toBe(true);
  });

  it('TokenUsage: sahiplik ve maliyet kolonlari sozlesmeye uygun', async () => {
    const cols = await columnsOf('TokenUsage');
    for (const c of [
      'userId',
      'operation',
      'preAssessmentId',
      'interviewId',
      'provider',
      'model',
      'inputTokens',
      'outputTokens',
      'estimatedCostUsd',
      'succeeded',
    ]) {
      expect(cols).toContain(c);
    }
  });
});
