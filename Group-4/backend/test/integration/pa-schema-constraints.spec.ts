import { PrismaClient } from '@prisma/client';

// T009 — 003-pre-assessment sema kisit testi.
// Ayni desen: schema-constraints.spec.ts (002-interview) — migration'in fiilen
// uyguladigi seyi dogrular, schema.prisma metnini degil. Calisan Postgres gerektirir.
//
// Dosya adi 'pa-' onekiyle ayristirildi: 002-interview'in kendi US1 testleri
// (us1-*.spec.ts, schema-constraints.spec.ts) zaten bu isimleri kullaniyor
// (bkz. devralma-dogrulama.md, "test dosyasi adi cakismasi" bulgusu).
describe('003-pre-assessment sema kisitlari', () => {
  const prisma = new PrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function indexDefsOf(table: string): Promise<string[]> {
    const rows = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = ${table}
    `;
    return rows.map((r) => r.indexdef);
  }

  async function columnsOf(table: string): Promise<string[]> {
    const rows = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table}
    `;
    return rows.map((r) => r.column_name);
  }

  it('PreAssessment: kullanici basina tek AKTIF kayit icin partial unique index mevcut (FR-004, SC-007)', async () => {
    const defs = await indexDefsOf('PreAssessment');
    expect(
      defs.some(
        (d) =>
          d.includes('pre_assessment_one_active_per_user') &&
          d.includes('UNIQUE') &&
          d.includes('"isActive" = true'),
      ),
    ).toBe(true);
  });

  it('PreAssessment: arsiv listesi index i mevcut (FR-009a)', async () => {
    const defs = await indexDefsOf('PreAssessment');
    expect(
      defs.some((d) => d.includes('userId') && d.includes('createdAt')),
    ).toBe(true);
  });

  it('PreAssessment: meslek-bagimsiz girdi kolonlari mevcut (FR-002, 2026-08-04)', async () => {
    const cols = await columnsOf('PreAssessment');
    for (const c of [
      'experienceYears',
      'workStatus',
      'workPreference',
      'teamPreference',
      'learningStyle',
      'problemApproach',
      'selfRatings',
      'skills',
      'openAnswers',
      'educationLevel',
      // FR-002d: turetilmis, kullaniciya sorulmaz ama SAKLANIR.
      'experienceLevel',
    ]) {
      expect(cols).toContain(c);
    }
  });

  it('PreAssessment: yazilima ozgu eski kolonlar KALDIRILDI (meslek-bagimsizlik)', async () => {
    const cols = await columnsOf('PreAssessment');
    expect(cols).not.toContain('interestAreas');
    expect(cols).not.toContain('skillSelections');
  });

  it('CompetencyReport: preAssessmentId benzersiz — 1-0..1 iliski', async () => {
    const defs = await indexDefsOf('CompetencyReport');
    expect(
      defs.some((d) => d.includes('UNIQUE') && d.includes('preAssessmentId')),
    ).toBe(true);
  });

  it('CompetencyReport: skor / yolHaritasi / alanlar kolonu YOK (FR-006, FR-006b)', async () => {
    const cols = await columnsOf('CompetencyReport');
    expect(cols).not.toContain('skor');
    expect(cols).not.toContain('score');
    expect(cols).not.toContain('yolHaritasi');
    // 2026-08-04: meslege gore bolumleme kaldirildi.
    expect(cols).not.toContain('alanlar');
    for (const c of [
      'genelOzet',
      'gucluYonler',
      'gelisimAlanlari',
      'calismaTarziOzeti',
      'guvenSeviyesi',
    ]) {
      expect(cols).toContain(c);
    }
  });

  it('TokenUsage.preAssessmentId artik gercek bir FK iliskisi (003 modeli eklendikten sonra)', async () => {
    const defs = await indexDefsOf('TokenUsage');
    // FK kisidi pg_indexes'te degil information_schema.table_constraints'te.
    const rows = await prisma.$queryRaw<{ constraint_name: string }[]>`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND table_name = 'TokenUsage' AND constraint_type = 'FOREIGN KEY'
    `;
    expect(
      rows.some((r) => r.constraint_name.includes('preAssessmentId')),
    ).toBe(true);
    expect(defs).toBeDefined();
  });
});
