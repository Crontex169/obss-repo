// DOSYA REHBERİ: LLM motorunu NestJS'e tanıtan montaj dosyası; hangi
// sağlayıcının (Groq/DeepSeek), hangi ayarlarla kullanılacağını burada
// birleştirir. Dışarıya sadece LlmService'i açar — diğer modüller sağlayıcı
// detaylarını hiç görmez.
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { LlmService } from './llm.service';
import { ALT_LLM_ROUTE, LLM_PROVIDER, type AltLlmRoute } from './llm.provider';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';
import {
  PROVIDER_CONFIG,
  buildProviderConfig,
  type ProviderConfig,
  type ProviderName,
} from './providers/provider.config';
import { TokenUsageService } from './token-usage.service';

// Paylasilan LLM motoru. DISA YALNIZCA LlmService acilir — cagiran dikeyler
// saglayiciyi, semayi veya maliyet tablosunu dogrudan gormez (3.1).
@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: PROVIDER_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService): ProviderConfig =>
        buildProviderConfig({
          LLM_PROVIDER: config.getOrThrow<ProviderName>('LLM_PROVIDER'),
          LLM_BASE_URL: config.getOrThrow<string>('LLM_BASE_URL'),
          LLM_API_KEY: config.getOrThrow<string>('LLM_API_KEY'),
          LLM_MODEL: config.getOrThrow<string>('LLM_MODEL'),
        }),
    },
    {
      provide: LLM_PROVIDER,
      inject: [PROVIDER_CONFIG],
      useFactory: (config: ProviderConfig) =>
        new OpenAiCompatibleProvider(config),
    },
    {
      // Yedek saglayici. Env eksikse null — LlmService bunu "yedek yok" olarak
      // okur ve birincil dustugunde hata dogrudan cagirana gider.
      provide: ALT_LLM_ROUTE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): AltLlmRoute | null => {
        const name = config.get<ProviderName>('LLM_ALT_PROVIDER');
        // Env dogrulamasi (env.validation.ts) yarim yapilandirmayi zaten
        // reddediyor; burada yalnizca "hic verilmemis" halini ayikliyoruz.
        if (!name) return null;

        const altConfig = buildProviderConfig({
          LLM_PROVIDER: name,
          LLM_BASE_URL: config.getOrThrow<string>('LLM_ALT_BASE_URL'),
          LLM_API_KEY: config.getOrThrow<string>('LLM_ALT_API_KEY'),
          LLM_MODEL: config.getOrThrow<string>('LLM_ALT_MODEL'),
        });
        return {
          provider: new OpenAiCompatibleProvider(altConfig),
          config: altConfig,
        };
      },
    },
    TokenUsageService,
    LlmService,
  ],
  exports: [LlmService],
})
export class LlmModule {}
