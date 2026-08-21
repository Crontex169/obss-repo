import { AdminService } from '../../src/admin/admin.service';
import type { PrismaService } from '../../src/prisma/prisma.service';
import type { StatsQuery } from '../../src/admin/dto/stats-query.dto';

// C2 — /api/admin/stats onbellegi.
// Sorgular PAHALI (iki tanesi satirlari cekip uygulama katmaninda topluyor);
// panel her acilista ayni hesabi tekrar odetiyordu. Burada dogrulanan tek sey:
// TTL icinde ikinci istek VERITABANINA GITMEZ, TTL kapaliyken gider.
describe('AdminService.getStats onbellegi', () => {
  const emptyRows = [[], [], [], []];
  const query = (days = 30): StatsQuery => ({ tokenWindowDays: days });

  // TTL cagri basina env'den okunur; her senaryo kendi degerini verir.
  function loadService(ttlMs?: string) {
    if (ttlMs === undefined) delete process.env.ADMIN_STATS_CACHE_TTL_MS;
    else process.env.ADMIN_STATS_CACHE_TTL_MS = ttlMs;
    const $transaction = jest.fn().mockResolvedValue(emptyRows);
    // groupBy/findMany yalnizca $transaction demetini KURMAK icin cagrilir;
    // sonuclari demetten gelir, bu yuzden bos vekil yeterli.
    const stub = jest.fn().mockReturnValue({});
    const service = new AdminService({
      $transaction,
      interview: { groupBy: stub, findMany: stub },
      tokenUsage: { findMany: stub },
    } as unknown as PrismaService);
    return { service, $transaction };
  }

  afterAll(() => {
    delete process.env.ADMIN_STATS_CACHE_TTL_MS;
  });

  it('TTL icindeki ikinci cagri DB ye gitmez ve ayni yaniti doner', async () => {
    const { service, $transaction } = loadService();

    const first = await service.getStats(query());
    const second = await service.getStats(query());

    expect($transaction).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it('farkli pencere kendi hesabini yapar (anahtar tokenWindowDays)', async () => {
    const { service, $transaction } = loadService();

    await service.getStats(query(30));
    await service.getStats(query(7));

    expect($transaction).toHaveBeenCalledTimes(2);
  });

  it('TTL suresi dolunca yeniden hesaplanir', async () => {
    const { service, $transaction } = loadService('20');

    await service.getStats(query());
    await new Promise((resolve) => setTimeout(resolve, 40));
    await service.getStats(query());

    expect($transaction).toHaveBeenCalledTimes(2);
  });

  it('TTL=0 onbellegi tamamen kapatir (entegrasyon testlerinin kostugu mod)', async () => {
    const { service, $transaction } = loadService('0');

    await service.getStats(query());
    await service.getStats(query());

    expect($transaction).toHaveBeenCalledTimes(2);
  });
});
