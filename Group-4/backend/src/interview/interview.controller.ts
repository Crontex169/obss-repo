// DOSYA REHBERİ: Görüşme oluşturma, soru cevaplama, rapor alma gibi tüm
// /api/interviews uç noktalarının kapısı. Gelen isteği doğrular, oturum/
// sahiplik kontrolünden geçirir ve gerçek işi interview.service.ts'e devreder
// — kendisi iş mantığı (LLM çağrısı, veritabanı) içermez.
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import type { Multer } from 'multer';
type MulterFile = Express.Multer.File;
import { SessionGuard } from '../auth/guards/session.guard';
import {
  LlmRateLimitGuard,
  llmQuota,
} from '../common/guards/llm-rate-limit.guard';
import { Throttle } from '@nestjs/throttler';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import {
  createInterviewSchema,
  type CreateInterviewInput,
} from './dto/create-interview.dto';
import {
  submitAnswerSchema,
  type SubmitAnswerInput,
} from './dto/submit-answer.dto';
import { panelEventSchema, type PanelEventInput } from './dto/panel-event.dto';
import {
  reportProblemSchema,
  type ReportProblemInput,
} from './dto/report-problem.dto';
import { InterviewOwnershipGuard } from './ownership/interview-ownership.guard';
import { resolveUploadHardLimitBytes } from '../pdf/pdf-extraction.service';
import { InterviewService } from './interview.service';

// contracts/interview-api.md. Guard sirasi: SessionGuard (sinif-seviyesi) ->
// kaynak uc noktalarinda InterviewOwnershipGuard -> LlmRateLimitGuard.
@Controller('api/interviews')
@UseGuards(SessionGuard)
export class InterviewController {
  constructor(private readonly interviewService: InterviewService) {}

  // §1: SessionGuard -> LlmRateLimitGuard(3/saat).
  @Post()
  @UseGuards(LlmRateLimitGuard)
  @Throttle(llmQuota(3))
  // docs/SECURITY.md S4: sert boyut siniri multer katmanindadir — servis
  // katmanindaki kontrol dosya tamamen bellege alindiktan SONRA calisiyordu.
  // Sinir bilerek servis sinirinin bir tik ustundedir ki 10-11 MB araligi
  // sozlesmedeki Turkce 400 yanitini almaya devam etsin (bkz. fonksiyon notu).
  @UseInterceptors(
    FileInterceptor('jobPostingFile', {
      limits: { fileSize: resolveUploadHardLimitBytes() },
    }),
  )
  async create(
    @Body(new ZodValidationPipe(createInterviewSchema))
    dto: CreateInterviewInput,
    @UploadedFile() file: MulterFile | undefined,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Req() req: Request & { user?: AuthUser },
  ) {
    if (dto.jobPostingSource === 'pdf' && !file) {
      throw new BadRequestException('PDF dosyasi yuklenmedi.');
    }

    const interview = await this.interviewService.create({
      dto,
      file,
      acceptLanguage,
      userId: req.user!.id,
    });

    return {
      interview,
      currentQuestion: await this.interviewService.currentQuestionOf(
        interview.id,
      ),
    };
  }

  // §2: kullaniciya kendi gorusmeleri (silinmisler HARIC), admin'e tumu.
  // Kaynak bazli guard YOK — liste zaten kullaniciya gore filtreleniyor.
  @Get()
  list(@Req() req: Request & { user?: AuthUser }) {
    return this.interviewService.list(req.user!);
  }

  // §3 (resume): oturumsuz -> 401 (SessionGuard), yabanci/yok kaynak -> 404
  // (InterviewOwnershipGuard, ikisi AYIRT EDILEMEZ).
  @Get(':id')
  @UseGuards(InterviewOwnershipGuard)
  findOne(@Param('id') id: string) {
    return this.interviewService.findOne(id);
  }

  // §4: SessionGuard -> InterviewOwnershipGuard -> LlmRateLimitGuard(60/saat).
  // 200 (contracts/interview-api.md §4) — NestJS POST varsayilani 201'i override eder.
  @Post(':id/answers')
  @HttpCode(HttpStatus.OK)
  @UseGuards(InterviewOwnershipGuard, LlmRateLimitGuard)
  @Throttle(llmQuota(60))
  submitAnswer(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(submitAnswerSchema)) dto: SubmitAnswerInput,
  ) {
    return this.interviewService.submitAnswer(id, dto);
  }

  // §5: ready -> 200 (LLM'e TEKRAR GIDILMEZ), pending -> 202, failed -> 409.
  @Get(':id/report')
  @UseGuards(InterviewOwnershipGuard)
  async getReport(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.interviewService.getReport(id);
    if (result.status === 'pending') {
      res.status(HttpStatus.ACCEPTED);
      return { reportStatus: 'pending' };
    }
    return { reportStatus: 'ready', report: result.report };
  }

  // §6: SessionGuard -> InterviewOwnershipGuard -> LlmRateLimitGuard(5/saat).
  @Post(':id/report/retry')
  @HttpCode(HttpStatus.OK)
  @UseGuards(InterviewOwnershipGuard, LlmRateLimitGuard)
  @Throttle(llmQuota(5))
  async retryReport(@Param('id') id: string) {
    const result = await this.interviewService.retryReport(id);
    return { reportStatus: 'ready', report: result.report };
  }

  // §7: SessionGuard -> InterviewOwnershipGuard. LLM cagrisi yok, hiz siniri yok
  // — salt telemetri (FR-034, contracts/interview-flow-rules.md §4.4).
  @Post(':id/panel-events')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(InterviewOwnershipGuard)
  panelEvent(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(panelEventSchema)) dto: PanelEventInput,
    @Req() req: Request & { user?: AuthUser },
  ): void {
    this.interviewService.logPanelEvent(id, req.user!.id, dto);
  }

  // "Bildir" aksiyonu (specs/007-ui-design Rötuş Notları — üç nokta menüsü):
  // sahiplik SessionGuard + InterviewOwnershipGuard ile ayni desende dogrulanir,
  // LLM cagrisi yok -> hiz siniri yok (panelEvent ile ayni gerekce).
  @Post(':id/report-problem')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(InterviewOwnershipGuard)
  async reportProblem(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(reportProblemSchema)) dto: ReportProblemInput,
    @Req() req: Request & { user?: AuthUser },
  ): Promise<void> {
    await this.interviewService.reportProblem(id, req.user!.id, dto.message);
  }

  // 004-history contracts/history-api.md §3 — soft-delete. Guard zaten-silinmis
  // kaydi da (owner icin) 404 sayar; ikinci cagri servise hic ulasmaz (FR-013
  // "veya kayit bulunamadi" dali, 2026-08-03 bulgusu).
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(InterviewOwnershipGuard)
  async softDelete(@Param('id') id: string): Promise<void> {
    await this.interviewService.softDelete(id);
  }
}
