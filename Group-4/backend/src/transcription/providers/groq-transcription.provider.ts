// DOSYA REHBERİ: Groq'un OpenAI-uyumlu /audio/transcriptions ucuna giden TEK
// adapter (ADR-0014). openai-compatible.provider.ts'teki desenin kopyası:
// aynı SDK, farklı kaynak (audio.transcriptions yerine chat.completions).
import OpenAI, { toFile } from 'openai';
import type { ClientOptions } from 'openai';
import { Logger } from '@nestjs/common';
import { TranscriptionProviderError } from '../transcription.errors';
import type {
  TranscribeArgs,
  TranscribeResult,
  TranscriptionProvider,
} from '../transcription.provider';

// Yalnizca Groq destekleniyor (ADR-0014) — ikinci saglayici/model secimi
// spec kapsami disi, env degiskeni eklenmedi (YAGNI).
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const GROQ_WHISPER_MODEL = 'whisper-large-v3-turbo';

export function buildGroqTranscriptionClientOptions(
  apiKey: string,
): ClientOptions {
  return {
    apiKey,
    baseURL: GROQ_BASE_URL,
    // Otomatik yeniden deneme YOK — openai-compatible.provider.ts ile ayni
    // gerekce: tek kullanici hatasi Groq ucretsiz katman kotasini katlamasin.
    maxRetries: 0,
  };
}

type AudioClient = Pick<OpenAI, 'audio'>;

export class GroqTranscriptionProvider implements TranscriptionProvider {
  private readonly client: AudioClient;

  constructor(apiKey: string, client?: AudioClient) {
    this.client =
      client ?? new OpenAI(buildGroqTranscriptionClientOptions(apiKey));
  }

  async transcribe(args: TranscribeArgs): Promise<TranscribeResult> {
    let response: { text: string };
    try {
      const file = await toFile(
        args.audio,
        `audio.${extensionOf(args.mimeType)}`,
        { type: args.mimeType },
      );
      response = await this.client.audio.transcriptions.create(
        {
          file,
          model: GROQ_WHISPER_MODEL,
          language: args.language,
          response_format: 'json',
        },
        { timeout: args.timeoutMs },
      );
    } catch (cause) {
      // Kullaniciya giden mesaj genel; GERCEK sebep (429 kota, ag hatasi,
      // 400 desteklenmeyen format) yalnizca burada gorunur.
      const status = (cause as { status?: number })?.status;
      const message = cause instanceof Error ? cause.message : String(cause);
      Logger.warn(
        `Whisper cagrisi basarisiz: status=${status ?? 'yok'}, mesaj=${message}`,
        GroqTranscriptionProvider.name,
      );
      throw new TranscriptionProviderError(undefined, cause);
    }

    return { text: response.text };
  }
}

// `audio/webm;codecs=opus` -> `webm`. Groq dosya UZANTISINDAN format cikarir
// (multipart Content-Type'a degil); tarayicinin urettigi MIME turunden
// dogru uzantiyi secmek bu yuzden gerekli.
function extensionOf(mimeType: string): string {
  const subtype = mimeType.split('/')[1]?.split(';')[0];
  return subtype && subtype.length > 0 ? subtype : 'webm';
}
