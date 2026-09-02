// DOSYA REHBERİ: Ön değerlendirmenin asıl iş mantığı: formu kaydeder,
// LLM'den yetkinlik raporunu ister, sonucu veritabanına yazar. Interview
// modülünden farklı olarak bu değerlendirme bağımsızdır, görüşme sürecini
// hiç etkilemez.
import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type ExperienceLevel,
  type ExperienceYears,
  type PreAssessment,
} from '@prisma/client';
import { resolveLanguage } from '../common/language';
import {
  LlmProviderError,
  LlmSchemaError,
  LlmTimeoutError,
} from '../llm/llm.errors';
import { LlmService } from '../llm/llm.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreatePreAssessmentInput } from './dto/create-pre-assessment.dto';
import {
  competencyReportSchema,
  type CompetencyReportResult,
} from './llm/competency-report.schema';
import {
  COMPETENCY_REPORT_TEMPERATURE,
  buildCompetencyReportSystemPrompt,
  buildCompetencyReportUserData,
} from './llm/competency-report.prompt';

export interface CreatePreAssessmentArgs {
  dto: CreatePreAssessmentInput;
  acceptLanguage: string | undefined;
  userId: string;
}

const WITH_REPORT = { report: true } as const;

@Injectable()
export class PreAssessmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  // US1: form -> LLM raporu -> tek aktif kayit (FR-002..FR-006, FR-002a, FR-016).
  async create(args: CreatePreAssessmentArgs) {
    const { dto, userId } = args;
    const language = resolveLanguage(args.acceptLanguage);

    // Kayit LLM cagrisindan ONCE olusturulur (interview.service.ts'in aksine):
    // TokenUsage yazimi preAssessmentId gerektirir (FR-010) ve status=generating
    // + isActive=false satiri partial unique index'i ETKILEMEZ (yalnizca
    // isActive=true satirlari kisitlanir) - bu yuzden guvenle onceden yazilabilir.
    const created = await this.prisma.preAssessment.create({
      data: {
        userId,
        experienceYears: dto.experienceYears,
        workStatus: dto.workStatus,
        workPreference: dto.workPreference,
        teamPreference: dto.teamPreference,
        problemApproach: dto.problemApproach,
        skills: dto.skills ?? [],
        openAnswers: dto.openAnswers,
        // FR-002d: kullaniciya SORULMAZ, deneyim suresinden turetilir.
        experienceLevel: deriveExperienceLevel(dto.experienceYears),
        language,
      },
    });

    let generated: CompetencyReportResult;
    try {
      generated = await this.llm.generateStructured({
        schema: competencyReportSchema,
        schemaName: 'competency_report',
        systemPrompt: buildCompetencyReportSystemPrompt(),
        userData: buildCompetencyReportUserData({
          experienceYears: dto.experienceYears,
          workStatus: dto.workStatus,
          workPreference: dto.workPreference,
          teamPreference: dto.teamPreference,
          problemApproach: dto.problemApproach,
          skills: dto.skills,
          openAnswers: dto.openAnswers,
          language,
        }),
        operation: 'pre_assessment',
        userId,
        preAssessmentId: created.id,
        temperature: COMPETENCY_REPORT_TEMPERATURE,
      });
    } catch (error) {
      // Basarisizlik akisi (FR-008/FR-009): rapor YAZILMAZ, mevcut aktif kayit
      // DEGISMEZ, bu kayit failed olarak isaretlenir. Hata NESNESI yeniden
      // firlatilir - HttpExceptionFilter zaten dogru statuye (504/502) esler.
      await this.prisma.preAssessment.update({
        where: { id: created.id },
        data: { status: 'failed', failureReason: failureReasonOf(error) },
      });
      throw error;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Eski aktif kayit (varsa) arsivlenir - SILINMEZ (FR-009a).
        await tx.preAssessment.updateMany({
          where: { userId, isActive: true, NOT: { id: created.id } },
          data: { isActive: false },
        });
        await tx.competencyReport.create({
          data: {
            preAssessmentId: created.id,
            genelOzet: generated.genelOzet,
            gucluYonler: generated.gucluYonler,
            gelisimAlanlari: generated.gelisimAlanlari,
            calismaTarziOzeti: generated.calismaTarziOzeti,
            guvenSeviyesi: generated.guvenSeviyesi,
          },
        });
        return tx.preAssessment.update({
          where: { id: created.id },
          data: { status: 'completed', isActive: true },
          include: WITH_REPORT,
        });
      });
    } catch (error) {
      // T043: eszamanli iki istek partial unique index'e carpar (FR-004, SC-007).
      // Kaybeden istek: rapor zaten uretildi ama yazilamadi - failed'e cekilir,
      // kullanici akisi tutarsiz "generating" durumunda asilı kalmaz.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        await this.prisma.preAssessment.update({
          where: { id: created.id },
          data: { status: 'failed' },
        });
        throw new ConflictException(
          'Zaten bir değerlendirme oluşturuluyor. Sayfayı yenileyin.',
        );
      }
      throw error;
    }
  }

  async findActive(user: { id: string; role: string }, userId?: string) {
    const targetUserId = user.role === 'admin' && userId ? userId : user.id;
    return this.prisma.preAssessment.findFirst({
      where: { userId: targetUserId, isActive: true },
      include: WITH_REPORT,
    });
  }

  async findOne(id: string, user: { id: string; role: string }) {
    const record = await this.prisma.preAssessment.findUnique({
      where: { id },
      include: WITH_REPORT,
    });
    // Sahiplik: yabanci kayit "yok" ile AYIRT EDILEMEZ (§1, InterviewOwnershipGuard
    // ile ayni disiplin) - 403 DEGIL, DAIMA 404.
    if (!record) throw new NotFoundException();
    if (user.role !== 'admin' && record.userId !== user.id) {
      throw new NotFoundException();
    }
    return record;
  }

  async list(
    user: { id: string; role: string },
    opts: { userId?: string; cursor?: string; limit?: number },
  ) {
    const isAdmin = user.role === 'admin';
    const targetUserId = isAdmin && opts.userId ? opts.userId : user.id;
    const limit = opts.limit ?? 20;

    const items = await this.prisma.preAssessment.findMany({
      where: {
        userId: isAdmin && !opts.userId ? undefined : targetUserId,
        status: { not: 'failed' },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        experienceYears: true,
        workStatus: true,
        experienceLevel: true,
        language: true,
        status: true,
        isActive: true,
        createdAt: true,
      },
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }
}

// FR-002d — deneyim seviyesi kullaniciya SORULMAZ, deneyim suresinden turetilir.
// Gerekce: "junior/senior" yazilim sektoru jargonudur; temizlik gorevlisi veya
// insaat iscisi bu terimlerle kendini konumlandiramaz (meslek-bagimsizlik, FR-002).
// Turetilen deger 002-interview FR-021 form on-doldurmasi tarafindan okunur ve
// kullanici orada degistirebilir - bu yuzden kaba bir esleme yeterlidir.
const EXPERIENCE_LEVEL_BY_YEARS: Record<ExperienceYears, ExperienceLevel> = {
  none: 'intern',
  lt1: 'intern',
  y1_3: 'junior',
  y3_5: 'junior',
  y5_10: 'senior',
  y10plus: 'senior',
};

export function deriveExperienceLevel(years: ExperienceYears): ExperienceLevel {
  return EXPERIENCE_LEVEL_BY_YEARS[years];
}

function failureReasonOf(error: unknown): PreAssessment['failureReason'] {
  if (error instanceof LlmTimeoutError) return 'timeout';
  if (error instanceof LlmSchemaError) return 'schema';
  if (error instanceof LlmProviderError) return 'provider';
  return 'provider';
}
