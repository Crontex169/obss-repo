// DOSYA REHBERİ: Görüşme (interview) modülünü NestJS'e tanıtan "montaj" dosyası
// — hangi servisleri, guard'ları ve dış modülleri (LLM, PDF çıkarma, veritabanı)
// bu özelliğin kullanacağını burada bir araya getirir.
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LlmModule } from '../llm/llm.module';
import { PdfExtractionService } from '../pdf/pdf-extraction.service';
import { PrismaModule } from '../prisma/prisma.module';
import { InterviewController } from './interview.controller';
import { InterviewService } from './interview.service';
import { InterviewOwnershipGuard } from './ownership/interview-ownership.guard';

@Module({
  imports: [
    PrismaModule,
    LlmModule,
    AuthModule,
    // ThrottlerModule kaydi app.module.ts'e tasindi (@Global() oldugu icin tek
    // forRoot yeter; iki global kayit ayni token'lari yeniden baglardi).
    // `llm` kovasi ve @Throttle(llmQuota(N)) override'lari aynen gecerlidir.
  ],
  controllers: [InterviewController],
  providers: [InterviewService, PdfExtractionService, InterviewOwnershipGuard],
})
export class InterviewModule {}
