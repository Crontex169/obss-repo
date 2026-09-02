// DOSYA REHBERİ: Asıl işin yapıldığı yer — iki controller'ın da çağırdığı iş
// mantığı katmanı. listInterviews: sayfalanmış görüşme listesini meslek
// filtresiyle çeker. getInterviewDetail: tek bir görüşmenin tüm detayını
// (sorular, cevaplar, rapor, token/maliyet) toplar. getStats: dört farklı
// istatistiği (meslek dağılımı, tamamlanma oranı, ortalama süre, günlük token
// grafiği) tek transaction içinde okuyup birleştirir, böylece rakamlar
// birbirini tutmayan anlardan gelmez. Bu dosyada da hiç create/update/delete
// metodu yok — "salt-okunur" garantisi servis katmanında da tekrarlanır.
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  UNSPECIFIED_POSITION,
  type ListInterviewsQuery,
} from './dto/list-interviews-query.dto';
import type { StatsQuery } from './dto/stats-query.dto';
import type {
  AdminInterviewDetail,
  AdminInterviewListResponse,
  AdminProblemReport,
  AdminQuestionFeedback,
  AdminStatsResponse,
  AdminTokenUsageSummary,
} from './dto/admin-response.types';

/**
 * Asıl işin yapıldığı yer — iki controller'ın da çağırdığı iş mantığı katmanı:

•  listInterviews  — sayfalanmış görüşme listesini, meslek filtresiyle birlikte veritabanından çeker.
•  getInterviewDetail  — tek bir görüşmenin tüm detayını (sorular, cevaplar, rapor, token/maliyet) toplar.
•  getStats  — dört farklı istatistiği (meslek dağılımı, tamamlanma oranı, ortalama süre, günlük token grafiği) tek transaction içinde okuyup birleştirir,
 böylece rakamlar birbirini tutmayan anlardan gelmez.
 */

// research.md §3: position null ise ayri bir "Belirsiz" kovasi; sessizce goz
// ardi edilmez. Normalizasyon TEK kaynakta (sunucu) yapilir, istemcide
// tekrarlanmaz.
export const UNSPECIFIED_POSITION_LABEL = 'Belirsiz';

export function resolvePositionLabel(position: string | null): string {
  return position ?? UNSPECIFIED_POSITION_LABEL;
}

// 005-admin: SALT-OKUNUR servis. Bu sinifta hicbir write metodu (create/update/
// delete) tanimlanmaz — FR-008 garantisi, route yoklugunun yaninda burada da
// korunur.
// PERF (C2): /api/admin/stats her cagrida DORT sorgu kosar ve bunlarin ikisi
// SATIRLARI CEKIP uygulama katmaninda toplar (tamamlanmis tum gorusmeler +
// cevap zaman damgalari; penceredeki tum TokenUsage satirlari). Panel her
// acilista, her sekme degisiminde, her F5'te bunu tekrar odetiyordu.
//
// Istatistik SANIYE SANIYE taze olmak zorunda degil: kisa omurlu bir onbellek
// ard arda gelen istekleri tek hesaba indirir. Pencere (tokenWindowDays)
// anahtarin parcasidir; 7 gunluk gorunum 30 gunlugun yanitini almaz.
//
// ponytail: surec-ici Map + TTL. Redis/cache-manager DEGIL — tek deger, tek
// tuketici, iptal gerektirmiyor (veri kendiliginden eskiyor). Cok-instance'ta
// her process kendi kopyasini tutar; sonuc yanlis olmaz, yalnizca tazelik
// instance'a gore en fazla TTL kadar oynar. Redis'e gecilirse (S1) buraya da
// paylasilan store konulabilir.
// Cagri basina okunur (modul yuklenirken degil): tek bir Number() parse'i
// yaninda dort sorgu duruyor, olculebilir bir maliyeti yok — karsiliginda
// deger testte ve calisirken modul yeniden yuklenmeden degistirilebilir.
// 0 = onbellek kapali.
function statsCacheTtlMs(): number {
  return Number(process.env.ADMIN_STATS_CACHE_TTL_MS ?? 30_000);
}

// 005-admin: SALT-OKUNUR servis (devam) — onbellek de yalnizca OKUMA yolundadir.
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // Anahtar: pencere gun sayisi. Deger: hesaplanmis yanit + yazildigi an.
  // Yanit salt-okunur olarak paylasilir (istemciye serilestirilir, mutasyona
  // ugramaz), bu yuzden kopyalanmaz.
  private readonly statsCache = new Map<
    number,
    { at: number; value: AdminStatsResponse }
  >();

  // contracts/admin-api.md §1 (FR-002, FR-003, FR-004, FR-014).
  // deletedAt HICBIR ZAMAN filtrelenmez; kullanici ayrimi YOKTUR.
  async listInterviews(
    query: ListInterviewsQuery,
  ): Promise<AdminInterviewListResponse> {
    const where = buildPositionFilter(query.position);
    const { page, pageSize } = query;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.interview.count({ where }),
      this.prisma.interview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          position: true,
          status: true,
          createdAt: true,
          completedAt: true,
          deletedAt: true,
          user: { select: { email: true } },
        },
      }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        ownerEmail: row.user.email,
        position: row.position,
        positionLabel: resolvePositionLabel(row.position),
        status: row.status,
        createdAt: row.createdAt,
        completedAt: row.completedAt,
        deletedAt: row.deletedAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  // contracts/admin-api.md §2 (FR-004, FR-005, FR-006, FR-007).
  // Sahiplik kontrolu YOK (authz-rules.md R3); soft-delete edilmis kayit da
  // EKSIKSIZ doner. Kayit gercekten yoksa null -> controller 404'e cevirir.
  async getInterviewDetail(id: string): Promise<AdminInterviewDetail | null> {
    const interview = await this.prisma.interview.findUnique({
      where: { id },
      select: {
        id: true,
        position: true,
        status: true,
        mode: true,
        level: true,
        language: true,
        createdAt: true,
        completedAt: true,
        deletedAt: true,
        reportStatus: true,
        user: { select: { email: true } },
        questions: {
          orderBy: { order: 'asc' },
          select: {
            order: true,
            type: true,
            text: true,
            options: true,
            answer: { select: { content: true } },
          },
        },
        report: {
          select: {
            overallImpression: true,
            strengths: true,
            improvementAreas: true,
            additionalNotes: true,
            technicalScore: true,
            behavioralScore: true,
            generalScore: true,
            // #76: FR-005 "eksiksiz rapor" — bu alan select'te olmadigi surece
            // admin, kullanicinin gordugunden AZINI goruyordu.
            questionFeedback: true,
          },
        },
      },
    });

    if (!interview) return null;

    return {
      id: interview.id,
      ownerEmail: interview.user.email,
      position: interview.position,
      positionLabel: resolvePositionLabel(interview.position),
      status: interview.status,
      mode: interview.mode,
      level: interview.level,
      language: interview.language,
      createdAt: interview.createdAt,
      completedAt: interview.completedAt,
      deletedAt: interview.deletedAt,
      questions: interview.questions.map((q) => ({
        order: q.order,
        type: q.type,
        text: q.text,
        options: q.options,
        answer: q.answer?.content ?? null,
      })),
      reportStatus: interview.reportStatus,
      // FR-006: rapor "ready" degilse null; ic hata metni ASLA tasinmaz —
      // istemci durumu yalnizca reportStatus'tan turetir.
      report:
        interview.reportStatus === 'ready' && interview.report
          ? {
              ...interview.report,
              // Prisma Json kolonu `JsonValue` doner. Icerigin sekli yazan
              // tarafta Zod ile dogrulaniyor (interview/llm/report.ts) ve
              // sunucu yazmadan once eliyor — okuma tarafinda yeniden
              // dogrulamak ayni semayi ikinci bir yerde tutmak olurdu.
              questionFeedback: interview.report
                .questionFeedback as unknown as AdminQuestionFeedback[],
            }
          : null,
      tokenUsage: await this.tokenUsageOf(id),
    };
  }

  // FR-007: succeeded=false kayitlar DAHIL (spec Assumptions — ham veriyle
  // birebir tutarlilik, SC-006). Hic kayit yoksa null -> "maliyet bilgisi yok".
  private async tokenUsageOf(
    interviewId: string,
  ): Promise<AdminTokenUsageSummary | null> {
    const agg = await this.prisma.tokenUsage.aggregate({
      where: { interviewId },
      _count: { _all: true },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        estimatedCostUsd: true,
      },
    });

    if (agg._count._all === 0) return null;

    return {
      totalTokens: (agg._sum.inputTokens ?? 0) + (agg._sum.outputTokens ?? 0),
      // Decimal -> string: para degerini JS number'a cevirmek kayipli olurdu.
      estimatedCostUsd: (agg._sum.estimatedCostUsd ?? 0).toString(),
    };
  }

  // contracts/admin-api.md §3 (FR-009..FR-013).
  // TUM toplamlara soft-delete edilmis gorusmeler DAHILDIR (Clarifications Q1)
  // — hicbir sorguda deletedAt filtresi yoktur, tam denetim seffafligi.
  async getStats(query: StatsQuery): Promise<AdminStatsResponse> {
    // TTL 0 = onbellek kapali (entegrasyon testleri boyle kosar: ayni process
    // icinde veri yazip hemen istatistik okuyan senaryolar bayat yanit almasin).
    const ttlMs = statsCacheTtlMs();
    const cached = this.statsCache.get(query.tokenWindowDays);
    if (ttlMs > 0 && cached && Date.now() - cached.at < ttlMs) {
      return cached.value;
    }

    const windowStart = startOfUtcDay(
      new Date(Date.now() - (query.tokenWindowDays - 1) * DAY_MS),
    );

    // TEK transaction: dort sorgu ayni anlik goruntuyu okur, boylece meslek
    // sayilari / tamamlanma orani / ortalama sure birbiriyle TUTARLI doner
    // (SC-006) — eszamanli yazma sirasinda karisik anlardan toplanmis,
    // birbirini tutmayan rakamlar uretilmez.
    // Prisma'nin groupBy donus tipi $transaction demeti icinde daraliyor
    // (_count cikarimi kayboluyor); sorgu sekilleri sabit oldugundan demet
    // burada acikca tiplenir.
    const [professionGroups, statusGroups, completedRows, tokenRows] =
      (await this.prisma.$transaction([
        this.prisma.interview.groupBy({
          by: ['position'],
          _count: { _all: true },
        }),
        this.prisma.interview.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
        // Prisma aggregate iki DateTime kolonunun FARKINI hesaplayamaz
        // (research.md §2): satirlar cekilip ortalama uygulama katmaninda
        // alinir. ponytail: vaka-calismasi olceginde sorun degil; hacim
        // buyurse $queryRaw ile AVG(...)'e gecilir.
        // FR-010 REVIZYONU (2026-08-11): "sure" artik ham completedAt-createdAt
        // DEGIL, "aktif sure" — kullanicinin gorusmeyi yarim birakip saatler/
        // gunler sonra geri donup tamamlamasi durumunda o bekleme suresi ortalamayi
        // anlamsizca sisiriyordu (bkz. AI_DEVLOG). Her cevabin answeredAt zaman
        // damgasi cekilir; ardindan olusum->ilk cevap->...->tamamlanma araligindaki
        // her bosluk ACTIVE_GAP_CAP_MS ile kirpilir (asagida activeDurationSeconds).
        this.prisma.interview.findMany({
          where: { completedAt: { not: null } },
          select: {
            createdAt: true,
            completedAt: true,
            questions: { select: { answer: { select: { answeredAt: true } } } },
          },
        }),
        // Prisma groupBy DATE_TRUNC desteklemez (research.md §4'teki notun
        // duzeltmesi): pencere icindeki satirlar cekilip gune gore uygulama
        // katmaninda toplanir. ponytail: pencere en fazla 90 gun, hacim dusuk;
        // buyurse $queryRaw ile GROUP BY date_trunc('day', ...)'a gecilir.
        // #cost: estimatedCostUsd de ayni pencerede cekilir; gunluk ve pencere
        // toplami maliyet FR-010 gorunurlugu icin seriyle BIRLIKTE dondurulur.
        this.prisma.tokenUsage.findMany({
          where: { createdAt: { gte: windowStart } },
          select: {
            createdAt: true,
            inputTokens: true,
            outputTokens: true,
            estimatedCostUsd: true,
          },
        }),
      ])) as [
        ProfessionGroup[],
        StatusGroup[],
        CompletedInterviewRow[],
        TokenRow[],
      ];

    const dailyTokenUsage = buildDailySeries(tokenRows, query.tokenWindowDays);

    const response: AdminStatsResponse = {
      countsByProfession: professionGroups.map((g) => ({
        position: g.position,
        label: resolvePositionLabel(g.position),
        count: g._count._all,
      })),
      averageDurationSeconds: activeDurationSeconds(completedRows),
      completionRatio: {
        completed: countFor(statusGroups, 'completed'),
        inProgress: countFor(statusGroups, 'in_progress'),
      },
      dailyTokenUsage,
      // Pencere toplam maliyeti gunluk serinin toplamidir — ayni pencere,
      // tek dogruluk kaynagi; istemci ayrica toplamak zorunda kalmaz.
      totalCostUsd: sumCostStrings(
        dailyTokenUsage.map((d) => d.estimatedCostUsd),
      ),
    };

    if (ttlMs > 0) {
      // Anahtar sayisi sinirli (tokenWindowDays 1-90), sinirsiz buyume yok.
      this.statsCache.set(query.tokenWindowDays, {
        at: Date.now(),
        value: response,
      });
    }
    return response;
  }
  // "Bildir" (interview-card ucgen menu) kayitlari — salt-okunur, en yeniden
  // eskiye. Sahiplik/silinmis filtresi yok: admin her kaydi gorur (R3 ile ayni ilke).
  async listProblemReports(): Promise<AdminProblemReport[]> {
    const rows = await this.prisma.interviewProblemReport.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        interviewId: true,
        message: true,
        createdAt: true,
        // InterviewOwnershipGuard raporlayanin sahibi oldugunu garantiler
        // (report-problem.dto.ts), bu yuzden e-posta interview.user'dan alinir
        // — ayri bir User iliskisi eklemeye gerek yok.
        interview: {
          select: { position: true, user: { select: { email: true } } },
        },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      interviewId: r.interviewId,
      ownerEmail: r.interview.user.email,
      position: r.interview.position,
      positionLabel: resolvePositionLabel(r.interview.position),
      message: r.message,
      createdAt: r.createdAt,
    }));
  }
}

const DAY_MS = 86_400_000;

interface ProfessionGroup {
  position: string | null;
  _count: { _all: number };
}

interface StatusGroup {
  status: string;
  _count: { _all: number };
}

interface TokenRow {
  createdAt: Date;
  inputTokens: number;
  outputTokens: number;
  // Gercekte Prisma.Decimal, testte number; ikisi de Number()/String() ile
  // guvenle islenir. Para 6 ondalikta sabit oldugundan toplama kayipsizdir.
  estimatedCostUsd: Prisma.Decimal | number | string;
}

function startOfUtcDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function countFor(groups: StatusGroup[], status: string): number {
  return groups.find((g) => g.status === status)?._count._all ?? 0;
}

interface CompletedInterviewRow {
  createdAt: Date;
  completedAt: Date | null;
  questions: Array<{ answer: { answeredAt: Date } | null }>;
}

// FR-010 (2026-08-11 revizyonu): "sure" artik ham completedAt-createdAt
// FARKI degil, "aktif sure" — cevaplar arasi (ve olusum->ilk cevap,
// son cevap->tamamlanma) her BOSLUK ACTIVE_GAP_CAP_MS ile kirpilarak
// toplanir. Boylece gorusmenin yarim birakilip cok sonra tamamlanmasi
// (ornek: 2 gun sonra geri donup bitirme) ortalamayi saatlerce sismis
// "bekleme suresi" ile bozmaz; yalnizca gercekci dusunme/yazma suresi
// sayilir. Eski davranis (ham fark) AI_DEVLOG'da 1902 dk'lik gozlemle
// belgelendi — bkz. AI-DEVLOG.md.
// Tamamlanmis gorusme yoksa null -> istemci "veri yok" gosterir (FR-013).
const ACTIVE_GAP_CAP_MS = 5 * 60 * 1000; // 5 dakika

function activeDurationMs(row: CompletedInterviewRow): number {
  const answeredAtTimes = row.questions
    .map((q) => q.answer?.answeredAt)
    .filter((d): d is Date => d != null)
    .sort((a, b) => a.getTime() - b.getTime());

  const timeline = [row.createdAt, ...answeredAtTimes, row.completedAt!];
  let total = 0;
  for (let i = 1; i < timeline.length; i++) {
    const gap = timeline[i].getTime() - timeline[i - 1].getTime();
    total += Math.min(gap, ACTIVE_GAP_CAP_MS);
  }
  return total;
}

function activeDurationSeconds(rows: CompletedInterviewRow[]): number | null {
  if (rows.length === 0) return null;
  const totalMs = rows.reduce((sum, r) => sum + activeDurationMs(r), 0);
  return totalMs / rows.length / 1000;
}

// FR-012 + research.md §4: pencerede veri OLMAYAN gunler 0 ile doldurulur,
// boylece grafik surekli bir cizgi cizer ve "veri yok" zarifce gorunur.
// #cost: her gun icin token toplaminin YANI SIRA tahmini maliyet (USD) de
// toplanir; para 6 ondalikta sabit tutulur (Decimal(10,6) ile hizali).
function buildDailySeries(
  rows: TokenRow[],
  windowDays: number,
): Array<{ date: string; totalTokens: number; estimatedCostUsd: string }> {
  const tokenTotals = new Map<string, number>();
  const costTotals = new Map<string, number>();
  for (const row of rows) {
    const key = isoDay(row.createdAt);
    tokenTotals.set(
      key,
      (tokenTotals.get(key) ?? 0) + row.inputTokens + row.outputTokens,
    );
    costTotals.set(
      key,
      (costTotals.get(key) ?? 0) + Number(row.estimatedCostUsd),
    );
  }

  const today = startOfUtcDay(new Date());
  return Array.from({ length: windowDays }, (_, i) => {
    const date = isoDay(
      new Date(today.getTime() - (windowDays - 1 - i) * DAY_MS),
    );
    return {
      date,
      totalTokens: tokenTotals.get(date) ?? 0,
      estimatedCostUsd: (costTotals.get(date) ?? 0).toFixed(6),
    };
  });
}

// Para toplami: string -> Number -> topla -> 6 ondalikta string. Decimal(10,6)
// ile hizali; deger araligi (dusuk hacim) Number'in guvenli tamsayi/ondalik
// sinirinin cok altinda oldugundan kayipsizdir.
function sumCostStrings(costs: string[]): string {
  return costs.reduce((sum, c) => sum + Number(c), 0).toFixed(6);
}

// "unspecified" ozel degeri position IS NULL kovasina esler (FR-003);
// parametre yoksa hic filtre uygulanmaz.
function buildPositionFilter(
  position: string | undefined,
): Prisma.InterviewWhereInput {
  if (position === undefined) return {};
  if (position === UNSPECIFIED_POSITION) return { position: null };
  return { position };
}
