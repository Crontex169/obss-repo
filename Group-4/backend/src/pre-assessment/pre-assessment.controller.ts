// DOSYA REHBERİ: Ön değerlendirme formunu gönderme ve raporu getirme uç
// noktalarının kapısı; oturum kontrolü ve LLM çağrı kotasını (saatte 5)
// burada uygular, gerçek işi service dosyasına devreder.
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { SessionGuard } from '../auth/guards/session.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import {
  LlmRateLimitGuard,
  llmQuota,
} from '../common/guards/llm-rate-limit.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  createPreAssessmentSchema,
  type CreatePreAssessmentInput,
} from './dto/create-pre-assessment.dto';
import { PreAssessmentService } from './pre-assessment.service';

// contracts/pre-assessment-api.md. Guard sirasi: SessionGuard (sinif-seviyesi)
// -> RolesGuard('user') (yalnizca POST) -> LlmRateLimitGuard(5/saat) (yalnizca POST).
// interview.controller.ts deseniyle ayni: sarmalayici guard dosyasi YOK, kota
// controller metodunda @Throttle(llmQuota(n)) ile verilir.
@Controller('api/pre-assessments')
@UseGuards(SessionGuard)
export class PreAssessmentController {
  constructor(private readonly preAssessmentService: PreAssessmentService) {}

  // FR-011a: admin salt okunur -> RolesGuard('user') admin'i 403 ile reddeder.
  // §3.5: LlmRateLimitGuard(5/saat) — devralinan guard, bu dilime ozgu sarmalayici YOK.
  @Post()
  @UseGuards(RolesGuard, LlmRateLimitGuard)
  @Roles('user')
  @Throttle(llmQuota(5))
  async create(
    @Body(new ZodValidationPipe(createPreAssessmentSchema))
    dto: CreatePreAssessmentInput,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Req() req: Request & { user?: AuthUser },
  ) {
    return this.preAssessmentService.create({
      dto,
      acceptLanguage,
      userId: req.user!.id,
    });
  }

  // Hikaye 2 kriter 1: LLM cagrilmaz. 200 (var) / 204 (hic yok, gövde YOK).
  @Get('active')
  async getActive(
    @Req() req: Request & { user?: AuthUser },
    @Query('userId') userId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const record = await this.preAssessmentService.findActive(
      req.user!,
      userId,
    );
    if (!record) {
      // passthrough:true - status'u burada set etmek yeterli, Nest bos govdeyi
      // kendisi tamamlar; manuel res.end() cagirmak "headers already sent"
      // hatasina yol acar (Nest ayrica gonderiye calisir).
      res.status(HttpStatus.NO_CONTENT);
      return;
    }
    return record;
  }

  // Hikaye 2 kriter 3: arsiv listesi, tarihe gore azalan, failed HARIC.
  @Get()
  list(
    @Req() req: Request & { user?: AuthUser },
    @Query('userId') userId: string | undefined,
    @Query('cursor') cursor: string | undefined,
    @Query('limit') limit: string | undefined,
  ) {
    return this.preAssessmentService.list(req.user!, {
      userId,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  // §1 sizinti onleme: yabanci/yok kayit AYIRT EDILEMEZ - ikisi de 404
  // (PreAssessmentService.findOne icinde, ayri bir OwnershipGuard GEREKMEZ -
  // interview'in aksine bu dilimde tek kaynak route'u var).
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id') id: string, @Req() req: Request & { user?: AuthUser }) {
    return this.preAssessmentService.findOne(id, req.user!);
  }
}
