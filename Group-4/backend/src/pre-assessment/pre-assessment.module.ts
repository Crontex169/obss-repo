// DOSYA REHBERİ: Ön değerlendirme özelliğini NestJS'e tanıtan montaj dosyası;
// LLM motorunu ve veritabanını bu özelliğe bağlar.
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LlmModule } from '../llm/llm.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PreAssessmentController } from './pre-assessment.controller';
import { PreAssessmentService } from './pre-assessment.service';

// LlmModule zaten app.module.ts'de kayitli - burada TEKRAR kaydedilmez, yalnizca
// imports edilir (plan.md § Yapi Karari). ThrottlerModule de app.module.ts'te ve
// @Global()'dir; @Throttle(llmQuota(5)) buradan da calisir.
@Module({
  imports: [PrismaModule, LlmModule, AuthModule],
  controllers: [PreAssessmentController],
  providers: [PreAssessmentService],
})
export class PreAssessmentModule {}
