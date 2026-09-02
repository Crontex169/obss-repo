// DOSYA REHBERİ: Admin ekranına dönen cevapların şekli. Hiçbir kontrol yapmaz,
// sadece TypeScript interface'leri tanımlar — "admin ekranına giden bir
// görüşme listesi şöyle görünür" sözleşmesi. Prisma'nın kendi modelleri
// yerine ayrı bir dosyada durmasının sebebi: admin'e giden veri, veritabanı
// tablosunun birebir kopyası değil, birden fazla tablo birleştirilmiş ve bazı
// alanlar hesaplanmış (positionLabel, estimatedCostUsd gibi) "görünüm" tipleri.
//
// contracts/admin-api.md yanit govdeleriyle BIREBIR. Yeni bir Prisma modeli
// DEGIL — yalnizca salt-okunur agregasyon/view tipleri (data-model.md).

/**
 *  Admin'e dönen cevapların şekli

 * Bu dosya hiçbir kontrol yapmıyor, sadece TypeScript  interface 'leri tanımlıyor. Yani "admin ekranına giden bir görüşme listesi şöyle görünür" diye bir sözleşme.
 */

export type AdminInterviewStatus = 'in_progress' | 'completed';
export type AdminReportStatus =
  'not_applicable' | 'pending' | 'ready' | 'failed';

export interface AdminInterviewListItem {
  id: string;
  /** User.email — admin gorunumunde sahibi e-postayla gosterilir (Clarifications Q2). */
  ownerEmail: string;
  position: string | null;
  /** position null ise "Belirsiz" (research.md §3) — normalizasyon TEK kaynakta, sunucuda. */
  positionLabel: string;
  status: AdminInterviewStatus;
  createdAt: Date;
  completedAt: Date | null;
  /** null degilse istemci "Silindi" rozeti gosterir (FR-004). */
  deletedAt: Date | null;
}

export interface AdminInterviewListResponse {
  items: AdminInterviewListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminQuestionWithAnswer {
  order: number;
  type: 'multiple_choice' | 'open_ended';
  text: string;
  options: string[];
  answer: string | null;
}

export interface AdminReport {
  overallImpression: string;
  strengths: string[];
  improvementAreas: string[];
  additionalNotes: string[];
  technicalScore: number;
  behavioralScore: number;
  generalScore: number;
  /**
   * Issue #68 soru bazli geri bildirim — FR-005 "eksiksiz rapor" geregi admin de
   * kullanicinin gordugu her seyi gorur. Prisma Json kolonu: tip guvenligi
   * DB'den degil, yazan taraftaki Zod semasindan gelir (interview/llm/report.ts).
   * Alan eklenmeden once uretilmis raporlarda bos dizi.
   */
  questionFeedback: AdminQuestionFeedback[];
}

export interface AdminQuestionFeedback {
  /** AdminQuestionWithAnswer.order ile eslesir. */
  order: number;
  verdict: 'dogru' | 'kismen' | 'yetersiz';
  correctAnswer: string;
  explanation: string;
}

export interface AdminTokenUsageSummary {
  totalTokens: number;
  /** Decimal -> string; JS number'a cevirmek para degerinde kayipli olurdu. */
  estimatedCostUsd: string;
}

export interface AdminInterviewDetail {
  id: string;
  ownerEmail: string;
  position: string | null;
  positionLabel: string;
  status: AdminInterviewStatus;
  mode: 'written' | 'voice';
  level: 'intern' | 'junior' | 'mid' | 'senior';
  language: 'tr' | 'en';
  createdAt: Date;
  completedAt: Date | null;
  deletedAt: Date | null;
  questions: AdminQuestionWithAnswer[];
  reportStatus: AdminReportStatus;
  /** reportStatus !== 'ready' ise null; ic hata metni ASLA donmez (FR-006). */
  report: AdminReport | null;
  /** Hic TokenUsage kaydi yoksa null -> istemci "maliyet bilgisi yok" (FR-007). */
  tokenUsage: AdminTokenUsageSummary | null;
}

// "Bildir" (interview-card ucgen menu) ile kullanicidan gelen serbest metin
// sikayet/geri bildirimlerin admin gorunumu — salt-okunur, en yeniden eskiye.
export interface AdminProblemReport {
  id: string;
  interviewId: string;
  ownerEmail: string;
  position: string | null;
  positionLabel: string;
  message: string;
  createdAt: Date;
}

export interface AdminStatsResponse {
  countsByProfession: Array<{
    position: string | null;
    label: string;
    count: number;
  }>;
  /**
   * Aktif sure ortalamasi (saniye) — ham completedAt-createdAt farki DEGIL.
   * Cevaplar arasindaki (ve olusum/tamamlanma sinirlarindaki) her bosluk 5
   * dakikada kirpilir, boylece yarim birakilip cok sonra tamamlanan
   * gorusmelerin bekleme suresi ortalamayi sismez (FR-010, 2026-08-11).
   * Tamamlanmis gorusme yoksa null (FR-013).
   */
  averageDurationSeconds: number | null;
  completionRatio: { completed: number; inProgress: number };
  /** tokenWindowDays gun; veri olmayan gunler 0 ile doldurulur (research.md §4). */
  dailyTokenUsage: Array<{
    date: string;
    totalTokens: number;
    /** O gunun tahmini maliyeti (USD). Decimal -> string; JS number'a cevirmek para degerinde kayipli olurdu. */
    estimatedCostUsd: string;
  }>;
  /** Penceredeki tum gunlerin tahmini maliyet toplami (USD) — string, para kaybi olmamasi icin. */
  totalCostUsd: string;
}
