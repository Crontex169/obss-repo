// DOSYA REHBERİ: Groq ve DeepSeek'in ikisi de OpenAI'ninkiyle aynı şekilde
// konuştuğu için yazılan TEK adaptör; hangi sağlayıcıya bağlanacağını
// provider.config.ts'ten okur. Sistem talimatıyla kullanıcı verisini ayrı
// mesaj olarak gönderir ki ikisi asla karışmasın (prompt injection'a karşı).
import OpenAI from 'openai';
import type { ClientOptions } from 'openai';
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
} from 'openai/resources/chat/completions';
import { Logger } from '@nestjs/common';
import { LlmProviderError } from '../llm.errors';
import type { LlmCallArgs, LlmCallResult, LlmProvider } from '../llm.provider';
import type { ProviderConfig } from './provider.config';

// TEK OpenAI-uyumlu adapter — Groq + DeepSeek (ADR-0007).
// Ikisi de OpenAI-uyumlu API sunar; ikinci bir SDK veya ikinci bir sinif gerekmez.

export function buildClientOptions(config: ProviderConfig): ClientOptions {
  return {
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    // Otomatik yeniden deneme YOK (3.4) — her tekrar kullanici tetikli.
    // Aksi halde tek kullanici hatasi Groq ucretsiz katman kotasini katlar.
    maxRetries: 0,
  };
}

export function buildChatRequest(
  config: ProviderConfig,
  args: LlmCallArgs,
): ChatCompletionCreateParamsNonStreaming {
  // Veri izolasyonu (5): sistem talimati ve kullanici verisi AYRI mesaj
  // rollerinde gider; tek string'e birlestirilmez.
  const systemPrompt =
    config.schemaDelivery === 'json_object_prompt'
      ? // DeepSeek: sema garantisi saglayicida YOK; sema prompt'a gomulur ve
        // "json" kelimesi sistem talimatinda gecmek zorundadir (saglayici sarti).
        `${args.systemPrompt}\n\nYanitini SADECE su JSON semasina uyan tek bir json nesnesi olarak ver:\n${JSON.stringify(args.jsonSchema)}`
      : args.systemPrompt;

  return {
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: args.userData },
    ],
    // Cagiran katman tavani GORUNUR cikti icin hesaplar; akil yurutme modelinde
    // `reasoning_content` de ayni butceden yenir (bkz. reasoningTokenBudget).
    max_tokens: args.maxTokens + config.reasoningTokenBudget,
    response_format:
      config.schemaDelivery === 'json_schema_strict'
        ? {
            type: 'json_schema',
            json_schema: {
              name: args.schemaName,
              strict: true,
              schema: args.jsonSchema,
            },
          }
        : { type: 'json_object' },
  };
}

type ChatClient = Pick<OpenAI, 'chat'>;

export class OpenAiCompatibleProvider implements LlmProvider {
  private readonly client: ChatClient;

  constructor(
    private readonly config: ProviderConfig,
    client?: ChatClient,
  ) {
    this.client = client ?? new OpenAI(buildClientOptions(config));
  }

  async call(args: LlmCallArgs): Promise<LlmCallResult> {
    // Tip acikca yazilir: annotate edilmezse `let completion` ortuk `any` olur
    // ve asagidaki choices/usage okumalari tip denetiminden kacar.
    let completion: ChatCompletion;
    try {
      completion = await this.client.chat.completions.create(
        buildChatRequest(this.config, args),
        // SDK tarafinda da kes: LlmService yarisi kazansa bile soket acik kalmasin.
        { timeout: args.timeoutMs },
      );
    } catch (cause) {
      // Kullaniciya giden mesaj genel ("servise ulasilamiyor"); GERCEK sebep
      // (429 kota, 400 gecersiz parametre, ag hatasi) yalnizca burada gorunur.
      // Loglanmazsa hata sinifi ayirt edilemez ve teshis tahmine kalir.
      const status = (cause as { status?: number })?.status;
      const message = cause instanceof Error ? cause.message : String(cause);
      Logger.warn(
        `Saglayici cagrisi basarisiz: model=${this.config.model}, ` +
          `status=${status ?? 'yok'}, max_tokens=${args.maxTokens}, mesaj=${message}`,
        OpenAiCompatibleProvider.name,
      );
      throw new LlmProviderError(undefined, cause);
    }

    // Bos govde sessizce gecmez: cagiran katmanda JSON.parse patlar ve hata
    // "model yanlis bicimde yanit uretti" gibi gorunur, oysa sebep saglayici
    // tarafindadir. finish_reason + usage varligi ikisini ayirir (ornegin
    // 'length' = tavan yetmedi, 'content_filter' = engellendi).
    const message = completion.choices[0]?.message;
    if (!message?.content) {
      const choice = completion.choices[0];
      Logger.warn(
        `Saglayici BOS govde dondu: finish_reason=${choice?.finish_reason}, ` +
          `usage=${completion.usage ? 'var' : 'YOK'}, ` +
          `mesaj_alanlari=${JSON.stringify(Object.keys(message ?? {}))}, ` +
          `choices=${completion.choices?.length ?? 0}`,
        OpenAiCompatibleProvider.name,
      );
    }

    return {
      content: completion.choices[0]?.message?.content ?? '',
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
      provider: this.config.name,
      model: this.config.model,
    };
  }
}
