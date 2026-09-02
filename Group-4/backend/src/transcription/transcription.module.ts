// DOSYA REHBERİ: STT motorunu NestJS'e tanıtan montaj dosyası — llm.module.ts
// ile AYNI desen. Dışarıya yalnızca TranscriptionService açılır.
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TRANSCRIPTION_PROVIDER } from './transcription.provider';
import type { TranscriptionProvider } from './transcription.provider';
import { GroqTranscriptionProvider } from './providers/groq-transcription.provider';
import { UnconfiguredTranscriptionProvider } from './providers/unconfigured-transcription.provider';
import { TranscriptionService } from './transcription.service';

@Module({
  providers: [
    {
      provide: TRANSCRIPTION_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): TranscriptionProvider => {
        const apiKey = config.get<string>('GROQ_API_KEY');
        return apiKey
          ? new GroqTranscriptionProvider(apiKey)
          : new UnconfiguredTranscriptionProvider();
      },
    },
    TranscriptionService,
  ],
  exports: [TranscriptionService],
})
export class TranscriptionModule {}
