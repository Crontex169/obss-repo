// DOSYA REHBERİ: Projedeki HER LLM çağrısının geçtiği tek kapı. Sağlayıcıyı
// çağırır, süreyi ölçer, gelen cevabı önce JSON'a çevirir sonra Zod ile
// ikinci kez doğrular (sağlayıcı söz verse de garanti etmeyebilir), ve
// sonucu ne olursa olsun (başarılı/başarısız) token kullanımını kaydeder.
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LlmOperation } from '@prisma/client';
import { z } from 'zod';
import {
  LlmError,
  LlmProviderError,
  LlmSchemaError,
  LlmTimeoutError,
} from './llm.errors';
import {
  ALT_LLM_ROUTE,
  LLM_PROVIDER,
  type AltLlmRoute,
  type LlmCallArgs,
  type LlmCallResult,
  type LlmProvider,
} from './llm.provider';
import {
  PROVIDER_CONFIG,
  type ProviderConfig,
} from './providers/provider.config';
import { toProviderSchema } from './schema-to-provider';
import { TokenUsageService } from './token-usage.service';

// Paylasilan LLM motorunun TEK giris noktasi — docs/API_CONVENTIONS.md 3.1.
// Domain BILMEZ: prompt ve semalar cagiran dikeyde (interview/llm/, 003 kendi
// klasorunde) durur. 003-pre-assessment bu motoru DEVRALIR.

// T125: coğu cagri (rapor, on degerlendirme, tekil soru uyarlama) icin yeterli
// varsayilan tavan. Buyuk cikti bekleyen cagrilar (N soru uretimi) kendi
// maxTokens'ini gecirir.
const DEFAULT_MAX_TOKENS = 4096;

export interface GenerateStructuredArgs<T> {
  schema: z.ZodType<T>;
  /** Sema adi (saglayici json_schema modu icin). */
  schemaName: string;
  systemPrompt: string;
  /** Kullanici verisi — DAIMA veri, asla talimat (5). */
  userData: string;
  /** Varsayilan: LLM_REQUEST_TIMEOUT_MS. Interview raporu 60_000 ile override eder. */
  timeoutMs?: number;
  /**
   * Varsayilan 4096 (LlmService). Sabit deger `strict` modda buyuk cikti
   * uretebilen cagrilarda (ör. N=20 soru) yaniti yarida keser — cagiran
   * katman cikti hacmine gore olcekleyip gecirmelidir (T125, §3).
   */
  maxTokens?: number;
  operation: LlmOperation;
  userId: string;
  interviewId?: string;
  preAssessmentId?: string;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(
    @Inject(LLM_PROVIDER) private readonly provider: LlmProvider,
    @Inject(PROVIDER_CONFIG) private readonly config: ProviderConfig,
    private readonly tokenUsage: TokenUsageService,
    private readonly configService: ConfigService,
    // Opsiyonel: yapilandirilmazsa null gelir ve birincil dustugunde hata
    // dogrudan cagirana gider (mevcut davranis).
    @Optional()
    @Inject(ALT_LLM_ROUTE)
    private readonly altRoute: AltLlmRoute | null = null,
  ) {}

  async generateStructured<T>(args: GenerateStructuredArgs<T>): Promise<T> {
    const timeoutMs =
      args.timeoutMs ??
      this.configService.get<number>('LLM_REQUEST_TIMEOUT_MS', 30_000);

    const callArgs = {
      jsonSchema: toProviderSchema(args.schema),
      schemaName: args.schemaName,
      systemPrompt: args.systemPrompt,
      userData: args.userData,
      timeoutMs,
      maxTokens: args.maxTokens ?? DEFAULT_MAX_TOKENS,
    };

    // Cagri ve MALIYET KAYDI ayni yapilandirmayi kullanmak ZORUNDA: ikisi
    // ayrisirsa token'lar bir saglayicidan, fiyat digerinden hesaplanir ve
    // admin panelindeki tutar sessizce yanlis olur. Bu yuzden cagriyi FIILEN
    // yapan saglayicinin yapilandirmasi asagida tasinir.
    let config = this.config;
    let attempt: { result: LlmCallResult; durationMs: number };
    try {
      attempt = await this.attempt(args, this.provider, config, callArgs);
    } catch (error) {
      // Yedege gecis (ADR-0007 R1): YALNIZCA saglayici ulasilamadiginda ve
      // YALNIZCA bir kez. Sema hatasi buraya dusmez — o, saglayicinin ayakta
      // olup yanlis bicimde yanit uretmesidir; ikinci saglayici da ayni veriyle
      // ayni hatayi uretebilir ve bedelini iki kez odemis oluruz (3.4).
      const gecilebilir =
        error instanceof LlmProviderError || error instanceof LlmTimeoutError;
      if (!this.altRoute || !gecilebilir) throw error;

      this.logger.warn(
        `Birincil saglayici (${config.name}) dustu, yedege geciliyor ` +
          `(${this.altRoute.config.name}) — operasyon=${args.operation}`,
      );
      config = this.altRoute.config;
      attempt = await this.attempt(
        args,
        this.altRoute.provider,
        config,
        callArgs,
      );
    }
    const { result, durationMs } = attempt;

    // Katman 2 — runtime Zod. HER saglayicida zorunlu; DeepSeek yolunda tek
    // garanti budur ve "tam N soru" gibi nicelik kisitlari yalnizca burada var (3.3).
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.content) as unknown;
    } catch (cause) {
      // Bos govde (saglayici yanit dondu ama content yok) ile bozuk JSON ayni
      // hataya dusuyordu ve ikisi de disaridan ayirt edilemiyordu. Uzunluk +
      // kisa onek yeter: tam govde loglanmaz (kullanici verisi tasiyabilir).
      this.logger.warn(
        `LLM yaniti JSON olarak ayristirilamadi (${args.operation}): ` +
          `uzunluk=${result.content.length}, ` +
          `onek=${JSON.stringify(result.content.slice(0, 200))}`,
      );
      await this.writeUsage(args, result, false, durationMs, config);
      throw new LlmSchemaError(undefined, cause);
    }

    const validated = args.schema.safeParse(parsed);
    if (!validated.success) {
      // Sessiz basarisizlik yasak (Ilke VI): dogrulamayi gecmeyen yanit
      // KAYDEDILMEZ, cagirana hata gider.
      //
      // Kullaniciya giden 502 mesaji bilinclice genel ("beklenen bicimde yanit
      // uretmedi"); HANGI kuralin ihlal edildigi yalnizca burada gorunur.
      // Loglanmazsa hata sunucu tarafinda tamamen teshis edilemez kaliyordu —
      // Zod hatasi `cause`'a konuluyor ama hicbir yerde okunmuyordu.
      this.logger.warn(
        `LLM semayi gecemedi (${args.operation}, sema=${args.schemaName}): ` +
          JSON.stringify(validated.error.issues),
      );
      await this.writeUsage(args, result, false, durationMs, config);
      throw new LlmSchemaError(undefined, validated.error);
    }

    await this.writeUsage(args, result, true, durationMs, config);
    return validated.data;
  }

  // Tek saglayici denemesi. Sure olcumu YALNIZCA saglayici cagrisini kapsar;
  // JSON.parse ve Zod dogrulamasi disarida kalir. Boylece kaydedilen deger
  // "LLM ne kadar bekletti" sorusunu yanitlar, kendi islememizle karismaz.
  private async attempt<T>(
    args: GenerateStructuredArgs<T>,
    provider: LlmProvider,
    config: ProviderConfig,
    callArgs: LlmCallArgs,
  ): Promise<{ result: LlmCallResult; durationMs: number }> {
    const startedAt = Date.now();
    try {
      const result = await withTimeout(
        provider.call(callArgs),
        callArgs.timeoutMs,
      );
      return { result, durationMs: Date.now() - startedAt };
    } catch (error) {
      // Saglayici hic yanit vermedi -> token bilgisi yok, 0 yazilir. Sure yine
      // yazilir: timeout'a kadar gecen bekleme de performans verisidir. Yedege
      // gecilse bile BU kayit silinmez — basarisiz deneme de gerceklesti.
      await this.writeUsage(args, null, false, Date.now() - startedAt, config);
      throw error instanceof LlmError
        ? error
        : new LlmProviderError(undefined, error);
    }
  }

  private writeUsage<T>(
    args: GenerateStructuredArgs<T>,
    result: LlmCallResult | null,
    succeeded: boolean,
    durationMs: number,
    // Cagriyi YAPAN saglayicinin yapilandirmasi — `this.config` DEGIL: ikinci
    // saglayiciya yonlendirilmis bir operasyonda fiyat tablosu da onunkidir.
    config: ProviderConfig = this.config,
  ): Promise<void> {
    return this.tokenUsage.record({
      userId: args.userId,
      operation: args.operation,
      interviewId: args.interviewId,
      preAssessmentId: args.preAssessmentId,
      provider: result?.provider ?? config.name,
      model: result?.model ?? config.model,
      inputTokens: result?.inputTokens ?? 0,
      outputTokens: result?.outputTokens ?? 0,
      succeeded,
      durationMs,
      pricing: config.pricing,
    });
  }
}

// Cagri basina timeout (3.2) — module gomulu sabit DEGIL. Saglayici SDK'si de
// kendi timeout'unu uygular; bu yaris, fake/yavas saglayicida da ust siniri garanti eder.
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new LlmTimeoutError()), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
