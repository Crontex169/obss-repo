import { AdminService } from '../../src/admin/admin.service';
import type { PrismaService } from '../../src/prisma/prisma.service';

// 005-admin US3 / T033 — FR-013, SC-007 + SC-006 tam aritmetigi.
//
// NEDEN Supertest degil: entegrasyon veritabani test dosyalari arasinda
// PAYLASILIR ve /api/admin/stats sistem geneli toplar; "hic kayit yok" durumu
// orada kurulamaz (baska testler eszamanli kayit yazar). Bu yuzden bos durum ve
// metriklerin BIREBIR aritmetigi, PrismaService sahtelenerek izole dogrulanir;
// uc noktanin sozlesmesi/guard'lari us-admin3-stats + us-admin1-list-auth
// dosyalarinda zaten Supertest ile kanitlaniyor (2026-08-04 analizi, bulgu U3).

interface GroupByArgs {
  by: string[];
}

function fakePrisma(data: {
  professionGroups?: Array<{
    position: string | null;
    _count: { _all: number };
  }>;
  statusGroups?: Array<{ status: string; _count: { _all: number } }>;
  completed?: Array<{
    createdAt: Date;
    completedAt: Date;
    questions?: Array<{ answer: { answeredAt: Date } | null }>;
  }>;
  tokens?: Array<{
    createdAt: Date;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd?: number | string;
  }>;
}): PrismaService {
  return {
    // getStats dort sorguyu tek transaction'da (anlik goruntu) calistirir.
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
    interview: {
      groupBy: jest.fn((args: GroupByArgs) =>
        Promise.resolve(
          args.by.includes('position')
            ? (data.professionGroups ?? [])
            : (data.statusGroups ?? []),
        ),
      ),
      findMany: jest.fn(() =>
        Promise.resolve(
          (data.completed ?? []).map((c) => ({ questions: [], ...c })),
        ),
      ),
    },
    tokenUsage: {
      findMany: jest.fn(() =>
        Promise.resolve(
          (data.tokens ?? []).map((t) => ({
            estimatedCostUsd: 0,
            ...t,
          })),
        ),
      ),
    },
  } as unknown as PrismaService;
}

describe('US3-admin istatistikler: bos durum ve tam aritmetik', () => {
  it('hic kayit yokken hata FIRLATMAZ, sifir/bos degerlerle doner (FR-013, SC-007)', async () => {
    const service = new AdminService(fakePrisma({}));

    const stats = await service.getStats({ tokenWindowDays: 30 });

    expect(stats.countsByProfession).toEqual([]);
    expect(stats.averageDurationSeconds).toBeNull();
    expect(stats.completionRatio).toEqual({ completed: 0, inProgress: 0 });
    // Veri yoksa bile pencere dolu doner: 30 gun, hepsi 0 (research.md §4).
    expect(stats.dailyTokenUsage).toHaveLength(30);
    expect(stats.dailyTokenUsage.every((d) => d.totalTokens === 0)).toBe(true);
    // #cost: veri yokken maliyet de sifirdir; her gun "0.000000", pencere "0.000000".
    expect(
      stats.dailyTokenUsage.every((d) => d.estimatedCostUsd === '0.000000'),
    ).toBe(true);
    expect(stats.totalCostUsd).toBe('0.000000');
  });

  it('ortalama sure "aktif sure"dir — uzun molalar 5 dk ile kirpilir (FR-010, 2026-08-11 revizyonu)', async () => {
    const base = new Date('2026-08-01T09:00:00.000Z');
    const service = new AdminService(
      fakePrisma({
        completed: [
          // Molasiz gorusme: cevaplar arasi hicbir bosluk 5 dk'yi asmiyor,
          // aktif sure ham farkla AYNI (300 sn).
          {
            createdAt: base,
            completedAt: new Date(base.getTime() + 300_000),
            questions: [
              { answer: { answeredAt: new Date(base.getTime() + 100_000) } },
              { answer: { answeredAt: new Date(base.getTime() + 200_000) } },
            ],
          },
          // Yarim birakilip 2 saat sonra tamamlanan gorusme: cevap YOK, tek
          // bosluk ham 7200 sn ama 300 sn'de KIRPILIR — eski formulde bu
          // gorusme ortalamayi tek basina saatlerce sisirirdi (bkz. AI_DEVLOG
          // 1902 dk gozlemi).
          {
            createdAt: base,
            completedAt: new Date(base.getTime() + 7_200_000),
            questions: [],
          },
        ],
      }),
    );

    const stats = await service.getStats({ tokenWindowDays: 30 });
    // (300 + 300) / 2 = 300 sn — ham formulde (300+7200)/2 = 3750 sn olurdu.
    expect(stats.averageDurationSeconds).toBe(300);
  });

  it('tamamlanma orani status sayimlarindan turer (FR-011)', async () => {
    const service = new AdminService(
      fakePrisma({
        statusGroups: [
          { status: 'completed', _count: { _all: 30 } },
          { status: 'in_progress', _count: { _all: 12 } },
        ],
      }),
    );

    const stats = await service.getStats({ tokenWindowDays: 30 });
    expect(stats.completionRatio).toEqual({ completed: 30, inProgress: 12 });
  });

  it('position=null grubu "Belirsiz" etiketiyle doner (FR-009, research.md §3)', async () => {
    const service = new AdminService(
      fakePrisma({
        professionGroups: [
          { position: 'Backend', _count: { _all: 5 } },
          { position: null, _count: { _all: 2 } },
        ],
      }),
    );

    const stats = await service.getStats({ tokenWindowDays: 30 });
    expect(stats.countsByProfession).toEqual(
      expect.arrayContaining([
        { position: 'Backend', label: 'Backend', count: 5 },
        { position: null, label: 'Belirsiz', count: 2 },
      ]),
    );
  });

  it('gunluk token toplami ayni gunun tum kayitlarini toplar, bos gunler 0 (FR-012, SC-006)', async () => {
    const today = new Date();
    today.setUTCHours(12, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 86_400_000);

    const service = new AdminService(
      fakePrisma({
        tokens: [
          {
            createdAt: today,
            inputTokens: 100,
            outputTokens: 50,
            estimatedCostUsd: 0.001,
          },
          {
            createdAt: today,
            inputTokens: 200,
            outputTokens: 80,
            estimatedCostUsd: 0.0025,
          },
          {
            createdAt: yesterday,
            inputTokens: 10,
            outputTokens: 5,
            estimatedCostUsd: 0.0001,
          },
        ],
      }),
    );

    const stats = await service.getStats({ tokenWindowDays: 3 });
    expect(stats.dailyTokenUsage).toHaveLength(3);

    const byDate = new Map(
      stats.dailyTokenUsage.map((d) => [d.date, d.totalTokens]),
    );
    expect(byDate.get(today.toISOString().slice(0, 10))).toBe(430);
    expect(byDate.get(yesterday.toISOString().slice(0, 10))).toBe(15);
    // Ucuncu gun (veri yok) sifir doldurulur.
    expect([...byDate.values()].filter((v) => v === 0)).toHaveLength(1);
    // Toplam, ham kayitlarin toplamiyla BIREBIR esittir (SC-006).
    expect([...byDate.values()].reduce((a, b) => a + b, 0)).toBe(445);

    // #cost: gunluk maliyet ayni gunun kayitlarini toplar; pencere toplami
    // tum gunlerin toplamidir, 6 ondalikta string (SC-006 maliyet karsiligi).
    const costByDate = new Map(
      stats.dailyTokenUsage.map((d) => [d.date, d.estimatedCostUsd]),
    );
    expect(costByDate.get(today.toISOString().slice(0, 10))).toBe('0.003500');
    expect(costByDate.get(yesterday.toISOString().slice(0, 10))).toBe('0.000100');
    expect(stats.totalCostUsd).toBe('0.003600');
  });
});
