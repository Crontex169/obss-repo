import type { PrismaService } from '../../../src/prisma/prisma.service';

// 005-admin T009: admin entegrasyon testleri icin cok-kullanicili / cok-gunlu
// senaryo kurucusu.
//
// NEDEN dogrudan Prisma seed'i (create-test-interview.ts / complete-interview.ts
// yerine): (1) POST /api/interviews kullanici basina 3/saat sinirlidir (FR-022) —
// senaryo tek kullanicida 3'ten fazla gorusme gerektirir; (2) helper'lar
// position'i ve createdAt'i disaridan almiyor, oysa bu dilim tam da meslek
// kovalari ve gunluk zaman serisi uzerine kurulu. Bu dilim SALT-OKUNUR
// oldugundan yazma yolunun kendisi 002-interview testlerinin sorumlulugundadir;
// burada yalnizca okunacak veri deterministik bicimde kurulur.

export interface SeedInterviewSpec {
  /** null -> "Belirsiz" kovasi (FR-003). */
  position: string | null;
  status?: 'in_progress' | 'completed';
  reportStatus?: 'not_applicable' | 'pending' | 'ready' | 'failed';
  /** Dolu ise soft-delete edilmis sayilir (FR-004). */
  deleted?: boolean;
  createdAt?: Date;
  /** completedAt = createdAt + durationSeconds (FR-010 ortalama sure hesabi). */
  durationSeconds?: number;
  questionCount?: number;
  /** Her biri ayri bir TokenUsage kaydi olur (FR-007, FR-012). */
  tokenUsages?: Array<{
    inputTokens: number;
    outputTokens: number;
    costUsd: string;
    createdAt?: Date;
    succeeded?: boolean;
  }>;
}

export interface SeededInterview {
  id: string;
  spec: SeedInterviewSpec;
}

export async function seedInterview(
  prisma: PrismaService,
  userId: string,
  spec: SeedInterviewSpec,
): Promise<SeededInterview> {
  const createdAt = spec.createdAt ?? new Date();
  const status = spec.status ?? 'completed';
  const completedAt =
    status === 'completed'
      ? new Date(createdAt.getTime() + (spec.durationSeconds ?? 600) * 1000)
      : null;
  const questionCount = spec.questionCount ?? 2;
  const reportStatus = spec.reportStatus ?? 'not_applicable';

  const interview = await prisma.interview.create({
    data: {
      userId,
      jobPostingSource: 'text',
      jobPostingText: 'Test ilan metni.',
      questionCount,
      mode: 'written',
      adaptiveEnabled: false,
      status,
      reportStatus,
      currentQuestionOrder: status === 'completed' ? questionCount : 1,
      position: spec.position,
      level: 'junior',
      language: 'tr',
      createdAt,
      completedAt,
      deletedAt: spec.deleted ? new Date() : null,
      questions: {
        create: Array.from({ length: questionCount }, (_, i) => ({
          order: i + 1,
          type:
            i % 2 === 1
              ? ('multiple_choice' as const)
              : ('open_ended' as const),
          text: `Soru ${i + 1}?`,
          options: i % 2 === 1 ? ['Secenek A', 'Secenek B'] : [],
          // Yarim kalan gorusmede yalnizca ilk soru cevaplanmis olsun.
          ...(status === 'completed' || i === 0
            ? {
                answer: {
                  create: {
                    content: `Cevap ${i + 1}`,
                    sourceMode: 'written' as const,
                  },
                },
              }
            : {}),
        })),
      },
      ...(reportStatus === 'ready'
        ? {
            report: {
              create: {
                overallImpression: 'Genel olarak yeterli.',
                strengths: ['Net iletisim'],
                improvementAreas: ['Derinlik'],
                additionalNotes: ['Ek not'],
                technicalScore: 70,
                behavioralScore: 80,
                generalScore: 75,
                // 002-interview T127: round((70+80+75)/3) — sunucudaki formulle ayni.
                overallScore: 75,
                // issue #68 soru bazli geri bildirim; #76 admin detayinda da doner.
                questionFeedback: [
                  {
                    order: 1,
                    verdict: 'kismen',
                    correctAnswer: 'Beklenen cevap 1',
                    explanation: 'Cevap eksik kaldi.',
                  },
                ],
              },
            },
          }
        : {}),
    },
  });

  for (const usage of spec.tokenUsages ?? []) {
    await prisma.tokenUsage.create({
      data: {
        userId,
        operation: 'question_generation',
        interviewId: interview.id,
        provider: 'groq',
        model: 'test-model',
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        estimatedCostUsd: usage.costUsd,
        succeeded: usage.succeeded ?? true,
        createdAt: usage.createdAt ?? new Date(),
      },
    });
  }

  return { id: interview.id, spec };
}

/** Gun basindan itibaren N gun geriye giden bir tarih (zaman serisi testleri). */
export function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

/** Testin actigi tum kullanicilari ve onlara bagli kayitlari temizler. */
export async function cleanupUsers(prisma: PrismaService, emails: string[]) {
  if (emails.length === 0) return;
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
}
