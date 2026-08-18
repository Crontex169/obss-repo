// DOSYA REHBERİ: Her LLM çağrısının ne kadar token harcadığını ve tahmini
// maliyetini (dolar) veritabanına kaydeden servis; başarısız çağrılarda bile
// kayıt yazar ki maliyet takibinde boşluk oluşmasın. Admin panelindeki
// maliyet istatistikleri buradan besleniyor.
import { Injectable, Logger } from '@nestjs/common';
import type { LlmOperation } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  estimateCostUsd,
  type ProviderPricing,
} from './providers/provider.config';

// Cross-cutting maliyet kaydi — FR-016, docs/API_CONVENTIONS.md 4.1.
// TEK tablo: TokenUsage. Dikey basina ayri maliyet tablosu YASAK.

export interface TokenUsageEntry {
  userId: string;
  operation: LlmOperation;
  interviewId?: string;
  preAssessmentId?: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  succeeded: boolean;
  /** Saglayici cagrisinin duvar saati suresi (ms); olculemezse undefined. */
  durationMs?: number;
  pricing: ProviderPricing;
}

@Injectable()
export class TokenUsageService {
  private readonly logger = new Logger(TokenUsageService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Basarisiz cagrilarda da yazilir (succeeded: false) — saglayici token
  // tuketmis olabilir, maliyet takibinde bosluk olusmaz.
  async record(entry: TokenUsageEntry): Promise<void> {
    const { pricing, inputTokens, outputTokens, ...rest } = entry;
    try {
      await this.prisma.tokenUsage.create({
        data: {
          ...rest,
          // Saglayici usage dondurmediyse 0 yazilir; kayit yine olusur.
          inputTokens: inputTokens || 0,
          outputTokens: outputTokens || 0,
          estimatedCostUsd: estimateCostUsd(
            pricing,
            inputTokens || 0,
            outputTokens || 0,
          ),
        },
      });
    } catch (error) {
      // Kullanici akisi BOZULMAZ (Hikaye 5 kriter 3) — ama sessizce yutulmaz.
      this.logger.error(
        `TokenUsage yazilamadi (operation=${entry.operation}, userId=${entry.userId})`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
