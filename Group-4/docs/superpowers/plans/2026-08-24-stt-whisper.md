# STT: Groq Whisper — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sözlü mod cevap verme akışında konuşmayı metne çevirme (STT) işini
tarayıcı `SpeechRecognition`'dan Groq Whisper'a taşımak — Türkçe transkript
kalitesini artırmak için. TTS (sorunun sesli okunması) değişmez.

**Architecture:** Backend'de `LlmModule`'ün port/adapter deseninin birebir
kopyası: `TranscriptionProvider` arayüzü (port), `GroqTranscriptionProvider`
(gerçek adapter, `openai` SDK ile Groq'un OpenAI-uyumlu `/audio/transcriptions`
ucuna gider) ve `UnconfiguredTranscriptionProvider` (anahtar yoksa). Yeni
`POST /api/interviews/:id/transcribe` ucu mevcut `InterviewController`'a
eklenir, ayrı bir `stt` hız-sınırı kovasıyla korunur (mevcut `llm` kovasından
bağımsız, aynı Redis deposunu kullanır — S1). Frontend'de `voice-client.ts`
`SpeechRecognition` yerine `MediaRecorder`+`getUserMedia`+`AnalyserNode` ile
kayıt yapar (ses seviyesiyle otomatik durdurma), kayıt bitince backend'e
yükler ve dönen metni mevcut inceleme (review) akışına aynen sokar.

**Tech Stack:** NestJS 11, `openai` SDK v7 (Groq'un OpenAI-uyumlu ucu için,
`LlmModule` zaten kullanıyor), `@nestjs/throttler` (mevcut Redis destekli
depo — S1), React 19 + Web Audio API (`MediaRecorder`, `AudioContext`,
`AnalyserNode`), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-24-stt-whisper-design.md`

## Global Constraints

- Groq base URL sabit: `https://api.groq.com/openai/v1` — env değişkeni YOK.
- Model sabit: `whisper-large-v3-turbo` — env değişkeni YOK.
- Yeni env: `GROQ_API_KEY` (opsiyonel, `LLM_API_KEY`'den BAĞIMSIZ).
- STT kotası: kullanıcı başına **30/saat**, ayrı `stt` kovası, mevcut S1
  Redis deposu (varsa) otomatik uygulanır.
- Azami ses yükleme boyutu: `MAX_AUDIO_UPLOAD_BYTES = 15 * 1024 * 1024`
  (15 MB) — Groq'un 25 MB/dosya sınırının altında, env değişkeni YOK.
- STT hatası → yazılı moda düş + hata göster. Otomatik yeniden deneme YOK.
- STT kotası **iade edilmez** (S5 kota iadesi bu kovaya UYGULANMAZ — spec
  kapsamı dışı, bilinçli).
- TTS (`speak`, `stopSpeaking`, `speech-queue.ts`, `speech-segment.ts`) HİÇ
  DEĞİŞMEZ.
- Türkçe kod yorumları repo konvansiyonuna uyar (DOSYA REHBERİ üst yorumu,
  NEDEN/GEREKÇE notları).

---

## Backend

### Task 1: `GROQ_API_KEY` ortam değişkeni

**Files:**
- Modify: `backend/src/config/env.validation.ts:57` (REDIS_URL satırından hemen sonra)
- Test: `backend/src/config/env.validation.spec.ts`

**Interfaces:**
- Produces: `Env.GROQ_API_KEY: string | undefined`

- [ ] **Step 1: Env şemasına alanı ekle**

`backend/src/config/env.validation.ts` içinde `REDIS_URL` satırından hemen sonra:

```ts
    // ADR-0014: Groq Whisper (STT). LLM_API_KEY'DEN BAGIMSIZ — LLM_PROVIDER
    // "deepseek" olsa bile sozlu modun STT kismi hep Groq'tan gelir. Boşsa
    // istek servis katmaninda TranscriptionProviderError firlatir (frontend
    // bunu normal saglayici hatasi gibi isler, ayri bir "yapilandirilmamis"
    // durumu yok — docs/superpowers/specs/2026-08-24-stt-whisper-design.md).
    GROQ_API_KEY: z.string().min(1).optional(),
```

- [ ] **Step 2: Var olan testi çalıştır (regresyon yok)**

Run: `cd backend && npx jest src/config/env.validation.spec.ts`
Expected: mevcut testler PASS (yeni alan opsiyonel, hiçbir testi bozmaz).

- [ ] **Step 3: Commit**

```bash
git add backend/src/config/env.validation.ts
git commit -m "feat(transcription): GROQ_API_KEY ortam degiskeni (ADR-0014)"
```

---

### Task 2: Transcription port + hata sınıfı

**Files:**
- Create: `backend/src/transcription/transcription.provider.ts`
- Create: `backend/src/transcription/transcription.errors.ts`

**Interfaces:**
- Produces:
  - `interface TranscribeArgs { audio: Buffer; mimeType: string; language: 'tr' | 'en'; timeoutMs: number }`
  - `interface TranscribeResult { text: string }`
  - `interface TranscriptionProvider { transcribe(args: TranscribeArgs): Promise<TranscribeResult> }`
  - `const TRANSCRIPTION_PROVIDER: symbol`
  - `class TranscriptionProviderError extends HttpException` (502, `details.retryable: true`)

- [ ] **Step 1: `transcription.provider.ts` dosyasını yaz**

```ts
// DOSYA REHBERİ: Gerçek STT sağlayıcısının (şimdilik yalnızca Groq Whisper)
// uyması gereken sözleşmeyi tanımlar — llm.provider.ts'teki port/adapter
// deseninin birebir kopyası. Test fake'i (test/fakes/fake-transcription.provider.ts)
// TAM BU sınırdan takılır — gerçek sağlayıcıya istek atan test YAZILMAZ.
export interface TranscribeArgs {
  audio: Buffer;
  mimeType: string;
  /** Interview.language — dogruluk ve gecikmeyi iyilestirir (Whisper ipucu). */
  language: 'tr' | 'en';
  timeoutMs: number;
}

export interface TranscribeResult {
  text: string;
}

export interface TranscriptionProvider {
  transcribe(args: TranscribeArgs): Promise<TranscribeResult>;
}

export const TRANSCRIPTION_PROVIDER = Symbol('TRANSCRIPTION_PROVIDER');
```

- [ ] **Step 2: `transcription.errors.ts` dosyasını yaz**

```ts
// DOSYA REHBERİ: STT çağrısından kaynaklanan hataları standart bir HTTP
// hatasına çeviren TEK sınıf — llm.errors.ts'teki desenle aynı: gerçek
// sağlayıcı hatası kullanıcıya gitmez, yalnızca `cause` içinde sunucu
// logunda kalır.
import { HttpException, HttpStatus } from '@nestjs/common';

// TranscriptionProviderError -> 502 BadGateway.
//
// TEK sinif yeterli (LLM'deki 3 ayrimin aksine): sonuc frontend'de HER
// zaman ayni davranisi tetikler (yaziliya dus + hata goster — spec karari),
// yani ag hatasi/zaman asimi/saglayici 5xx/yapilandirilmamis anahtar
// ARASINDA ayrim yapmanin bir tuketicisi yok.
export class TranscriptionProviderError extends HttpException {
  constructor(
    message = 'Ses metne cevrilemedi. Lutfen tekrar deneyin.',
    cause?: unknown,
  ) {
    super({ message, details: { retryable: true } }, HttpStatus.BAD_GATEWAY, {
      cause,
    });
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `cd backend && npx tsc -p tsconfig.json --noEmit`
Expected: hata yok (bu dosyalar henüz hiçbir yerden import edilmiyor, ama syntax/tip hatası olmamalı).

- [ ] **Step 4: Commit**

```bash
git add backend/src/transcription/transcription.provider.ts backend/src/transcription/transcription.errors.ts
git commit -m "feat(transcription): TranscriptionProvider portu ve hata sinifi"
```

---

### Task 3: Groq Whisper adapter'ı

**Files:**
- Create: `backend/src/transcription/providers/groq-transcription.provider.ts`
- Test: `backend/test/unit/groq-transcription-provider.spec.ts`

**Interfaces:**
- Consumes: `TranscribeArgs`, `TranscribeResult`, `TranscriptionProvider`, `TranscriptionProviderError` (Task 2)
- Produces:
  - `function buildGroqTranscriptionClientOptions(apiKey: string): ClientOptions`
  - `class GroqTranscriptionProvider implements TranscriptionProvider` — `constructor(apiKey: string, client?: Pick<OpenAI, 'audio'>)`

- [ ] **Step 1: Failing testi yaz**

`backend/test/unit/groq-transcription-provider.spec.ts`:

```ts
import {
  GroqTranscriptionProvider,
  buildGroqTranscriptionClientOptions,
} from '../../src/transcription/providers/groq-transcription.provider';
import { TranscriptionProviderError } from '../../src/transcription/transcription.errors';

// ADR-0014 — openai-compatible.provider.ts'teki llm-no-retry.spec.ts
// deseninin kopyasi: gercek Groq'a istek atilmaz, SDK'nin `audio` yuzeyi
// sahtelenir.
describe('GroqTranscriptionProvider', () => {
  it('SDK maxRetries: 0 ve Groq baseURL ile kurulur', () => {
    expect(buildGroqTranscriptionClientOptions('test-key')).toMatchObject({
      apiKey: 'test-key',
      baseURL: 'https://api.groq.com/openai/v1',
      maxRetries: 0,
    });
  });

  it('basarili yanitta metni doner, dogru model/dil/format ile cagirir', async () => {
    const create = jest.fn().mockResolvedValue({ text: 'merhaba dunya' });
    const provider = new GroqTranscriptionProvider('test-key', {
      audio: { transcriptions: { create } },
    } as never);

    const result = await provider.transcribe({
      audio: Buffer.from('sahte-ses-baytlari'),
      mimeType: 'audio/webm',
      language: 'tr',
      timeoutMs: 5000,
    });

    expect(result).toEqual({ text: 'merhaba dunya' });
    expect(create).toHaveBeenCalledTimes(1);
    const [params, options] = create.mock.calls[0] as [
      { model: string; language: string; response_format: string },
      { timeout: number },
    ];
    expect(params.model).toBe('whisper-large-v3-turbo');
    expect(params.language).toBe('tr');
    expect(params.response_format).toBe('json');
    expect(options.timeout).toBe(5000);
  });

  it('saglayici hatasinda TranscriptionProviderError firlatir, TEK istek yapilir', async () => {
    const create = jest.fn().mockRejectedValue(new Error('503'));
    const provider = new GroqTranscriptionProvider('test-key', {
      audio: { transcriptions: { create } },
    } as never);

    await expect(
      provider.transcribe({
        audio: Buffer.from('x'),
        mimeType: 'audio/webm',
        language: 'en',
        timeoutMs: 1000,
      }),
    ).rejects.toThrow(TranscriptionProviderError);

    expect(create).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `cd backend && npx jest test/unit/groq-transcription-provider.spec.ts`
Expected: FAIL — `Cannot find module '../../src/transcription/providers/groq-transcription.provider'`

- [ ] **Step 3: Adapter'ı yaz**

`backend/src/transcription/providers/groq-transcription.provider.ts`:

```ts
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
    this.client = client ?? new OpenAI(buildGroqTranscriptionClientOptions(apiKey));
  }

  async transcribe(args: TranscribeArgs): Promise<TranscribeResult> {
    let response: { text: string };
    try {
      const file = await toFile(args.audio, `audio.${extensionOf(args.mimeType)}`, {
        type: args.mimeType,
      });
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
```

- [ ] **Step 4: Testi tekrar çalıştır**

Run: `cd backend && npx jest test/unit/groq-transcription-provider.spec.ts`
Expected: PASS (3 test)

- [ ] **Step 5: Typecheck**

Run: `cd backend && npx tsc -p tsconfig.json --noEmit`
Expected: hata yok

- [ ] **Step 6: Commit**

```bash
git add backend/src/transcription/providers/groq-transcription.provider.ts backend/test/unit/groq-transcription-provider.spec.ts
git commit -m "feat(transcription): Groq Whisper adapter'i"
```

---

### Task 4: Yapılandırılmamış (anahtar yok) adapter

**Files:**
- Create: `backend/src/transcription/providers/unconfigured-transcription.provider.ts`
- Test: `backend/test/unit/unconfigured-transcription-provider.spec.ts`

**Interfaces:**
- Consumes: `TranscriptionProvider`, `TranscriptionProviderError` (Task 2)
- Produces: `class UnconfiguredTranscriptionProvider implements TranscriptionProvider`

- [ ] **Step 1: Failing testi yaz**

`backend/test/unit/unconfigured-transcription-provider.spec.ts`:

```ts
import { UnconfiguredTranscriptionProvider } from '../../src/transcription/providers/unconfigured-transcription.provider';
import { TranscriptionProviderError } from '../../src/transcription/transcription.errors';

// GROQ_API_KEY yok -> her cagri AYNI hata (spec karari: ayri bir
// "yapilandirilmamis" durumu yok, saglayici hatasiyla AYNI yoldan gecer).
describe('UnconfiguredTranscriptionProvider', () => {
  it('her cagri TranscriptionProviderError firlatir', async () => {
    const provider = new UnconfiguredTranscriptionProvider();
    await expect(
      provider.transcribe({
        audio: Buffer.from('x'),
        mimeType: 'audio/webm',
        language: 'tr',
        timeoutMs: 1000,
      }),
    ).rejects.toThrow(TranscriptionProviderError);
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `cd backend && npx jest test/unit/unconfigured-transcription-provider.spec.ts`
Expected: FAIL — modül bulunamadı

- [ ] **Step 3: Adapter'ı yaz**

`backend/src/transcription/providers/unconfigured-transcription.provider.ts`:

```ts
// DOSYA REHBERİ: GROQ_API_KEY ayarlanmamışsa devreye giren "boş nesne"
// adapter — sözlü modun STT kısmı kapalı sayılır. Kullanıcıya giden hata
// sağlayıcı hatasıyla AYNIDIR (spec karari, 2026-08-24): ayrı bir
// "yapılandırılmamış" durumu eklenmedi, tek hata yolu ikisini de kapsar.
import { TranscriptionProviderError } from '../transcription.errors';
import type {
  TranscribeArgs,
  TranscribeResult,
  TranscriptionProvider,
} from '../transcription.provider';

export class UnconfiguredTranscriptionProvider implements TranscriptionProvider {
  transcribe(_args: TranscribeArgs): Promise<TranscribeResult> {
    return Promise.reject(new TranscriptionProviderError());
  }
}
```

- [ ] **Step 4: Testi tekrar çalıştır**

Run: `cd backend && npx jest test/unit/unconfigured-transcription-provider.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/transcription/providers/unconfigured-transcription.provider.ts backend/test/unit/unconfigured-transcription-provider.spec.ts
git commit -m "feat(transcription): GROQ_API_KEY yoksa devreye giren adapter"
```

---

### Task 5: `TranscriptionService` + `TranscriptionModule`

**Files:**
- Create: `backend/src/transcription/transcription.service.ts`
- Create: `backend/src/transcription/transcription.module.ts`
- Create: `backend/test/fakes/fake-transcription.provider.ts`
- Test: `backend/test/unit/transcription-service.spec.ts`

**Interfaces:**
- Consumes: `TRANSCRIPTION_PROVIDER`, `TranscriptionProvider` (Task 2), `GroqTranscriptionProvider` (Task 3), `UnconfiguredTranscriptionProvider` (Task 4)
- Produces:
  - `const MAX_AUDIO_UPLOAD_BYTES: number`
  - `class TranscriptionService { transcribe(audio: Buffer, mimeType: string, language: 'tr' | 'en'): Promise<TranscribeResult> }`
  - `class TranscriptionModule` — `exports: [TranscriptionService]`
  - `class FakeTranscriptionProvider implements TranscriptionProvider` (test double, `calls`, `enqueue`, `always`)

- [ ] **Step 1: Paylaşılan test fake'ini yaz**

`backend/test/fakes/fake-transcription.provider.ts`:

```ts
import type {
  TranscribeArgs,
  TranscribeResult,
  TranscriptionProvider,
} from '../../src/transcription/transcription.provider';

// PAYLASILAN STT test fake'i — fake-llm.provider.ts ile AYNI desen. Gercek
// saglayiciya istek atan test YAZILMAZ.
export interface FakeTranscriptionScenario {
  text?: string;
  /** transcribe() bunu firlatir (saglayici hatasi simulasyonu). */
  error?: unknown;
}

export class FakeTranscriptionProvider implements TranscriptionProvider {
  readonly calls: TranscribeArgs[] = [];

  private queue: FakeTranscriptionScenario[] = [];
  private fallback: FakeTranscriptionScenario = { text: '' };

  enqueue(...scenarios: FakeTranscriptionScenario[]): this {
    this.queue.push(...scenarios);
    return this;
  }

  always(scenario: FakeTranscriptionScenario): this {
    this.fallback = scenario;
    return this;
  }

  reset(): void {
    this.calls.length = 0;
    this.queue = [];
  }

  async transcribe(args: TranscribeArgs): Promise<TranscribeResult> {
    this.calls.push(args);
    const scenario = this.queue.shift() ?? this.fallback;
    if (scenario.error !== undefined) throw scenario.error;
    return { text: scenario.text ?? '' };
  }
}
```

- [ ] **Step 2: Failing testi yaz**

`backend/test/unit/transcription-service.spec.ts`:

```ts
import { TranscriptionService } from '../../src/transcription/transcription.service';
import { FakeTranscriptionProvider } from '../fakes/fake-transcription.provider';

describe('TranscriptionService', () => {
  it('saglayiciyi dogru argumanlarla cagirir ve metni doner', async () => {
    const fake = new FakeTranscriptionProvider();
    fake.always({ text: 'deneme metni' });
    const service = new TranscriptionService(fake);

    const result = await service.transcribe(
      Buffer.from('ses'),
      'audio/webm',
      'tr',
    );

    expect(result).toEqual({ text: 'deneme metni' });
    expect(fake.calls[0]).toMatchObject({
      mimeType: 'audio/webm',
      language: 'tr',
    });
    expect(fake.calls[0].timeoutMs).toBeGreaterThan(0);
  });

  it('saglayici hatasi oldugu gibi yukari gider', async () => {
    const fake = new FakeTranscriptionProvider();
    fake.always({ error: new Error('boom') });
    const service = new TranscriptionService(fake);

    await expect(
      service.transcribe(Buffer.from('ses'), 'audio/webm', 'en'),
    ).rejects.toThrow('boom');
  });
});
```

- [ ] **Step 3: Testi çalıştır, başarısız olduğunu doğrula**

Run: `cd backend && npx jest test/unit/transcription-service.spec.ts`
Expected: FAIL — modül bulunamadı

- [ ] **Step 4: `TranscriptionService`'i yaz**

`backend/src/transcription/transcription.service.ts`:

```ts
// DOSYA REHBERİ: Controller'ın gördüğü tek yüz — sağlayıcı (Groq/yapılandırılmamış)
// detayını gizler, sabit zaman aşımını ve azami yükleme boyutunu burada tutar.
import { Inject, Injectable } from '@nestjs/common';
import {
  TRANSCRIPTION_PROVIDER,
  type TranscribeResult,
  type TranscriptionProvider,
} from './transcription.provider';

// Groq'un 25 MB/dosya sinirinin (ucretsiz katman) altinda kalinir. Gorusme
// cevaplari QUESTION_TIME_LIMIT_SECONDS (90 sn) ile sinirlidir; gercekci bir
// kayit bunun COK altindadir — ayarlanabilir env degiskeni gerekmez (YAGNI).
export const MAX_AUDIO_UPLOAD_BYTES = 15 * 1024 * 1024;

// LLM_REQUEST_TIMEOUT_MS varsayilaniyla AYNI (docs/API_CONVENTIONS.md 3.2).
export const TRANSCRIPTION_TIMEOUT_MS = 30_000;

@Injectable()
export class TranscriptionService {
  constructor(
    @Inject(TRANSCRIPTION_PROVIDER)
    private readonly provider: TranscriptionProvider,
  ) {}

  transcribe(
    audio: Buffer,
    mimeType: string,
    language: 'tr' | 'en',
  ): Promise<TranscribeResult> {
    return this.provider.transcribe({
      audio,
      mimeType,
      language,
      timeoutMs: TRANSCRIPTION_TIMEOUT_MS,
    });
  }
}
```

- [ ] **Step 5: `TranscriptionModule`'ü yaz**

`backend/src/transcription/transcription.module.ts`:

```ts
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
```

- [ ] **Step 6: Testi tekrar çalıştır**

Run: `cd backend && npx jest test/unit/transcription-service.spec.ts`
Expected: PASS (2 test)

- [ ] **Step 7: Typecheck**

Run: `cd backend && npx tsc -p tsconfig.json --noEmit`
Expected: hata yok

- [ ] **Step 8: Commit**

```bash
git add backend/src/transcription/transcription.service.ts backend/src/transcription/transcription.module.ts backend/test/fakes/fake-transcription.provider.ts backend/test/unit/transcription-service.spec.ts
git commit -m "feat(transcription): TranscriptionService + modul + test fake'i"
```

---

### Task 6: `stt` hız-sınırı kovası

**Files:**
- Create: `backend/src/common/guards/stt-rate-limit.guard.ts`
- Test: `backend/test/unit/stt-rate-limit.spec.ts`

**Interfaces:**
- Consumes: `logThrottled`, `setRetryAfter` (mevcut `throttle-response.ts`)
- Produces:
  - `class SttRateLimitGuard extends ThrottlerGuard`
  - `const STT_THROTTLER_NAME = 'stt'`
  - `function sttQuota(limit: number)`

- [ ] **Step 1: Failing testi yaz**

`backend/test/unit/stt-rate-limit.spec.ts` — `llm-rate-limit.spec.ts` deseninin kopyası:

```ts
import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorageService } from '@nestjs/throttler';
import { SttRateLimitGuard } from '../../src/common/guards/stt-rate-limit.guard';

// ADR-0014 — sozlu mod STT cagrilari icin kullanici basina saatlik sayac.
// llm-rate-limit.spec.ts ile AYNI desen, ayri 'stt' kovasi.
describe('SttRateLimitGuard', () => {
  const TTL_MS = 3_600_000;
  let storage: ThrottlerStorageService;
  let guard: SttRateLimitGuard;

  function contextFor(userId: string): ExecutionContext {
    const req = {
      user: { id: userId },
      ip: '203.0.113.7',
      headers: {},
      method: 'POST',
      path: '/api/interviews/abc/transcribe',
    };
    const res = { header: jest.fn(), setHeader: jest.fn(), headersSent: false };
    const handler = function endpoint() {};
    return {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
      getHandler: () => handler,
      getClass: () => class Ctrl {},
      getType: () => 'http',
      __res: res,
    } as unknown as ExecutionContext;
  }

  beforeEach(async () => {
    storage = new ThrottlerStorageService();
    guard = new SttRateLimitGuard(
      [{ name: 'stt', ttl: TTL_MS, limit: 2 }],
      storage,
      new Reflector(),
    );
    await guard.onModuleInit();
  });

  afterEach(() => {
    storage.onApplicationShutdown();
  });

  it('limit icindeki cagrilara izin verir, asimda 429 firlatir', async () => {
    const ctx = contextFor('user-a');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException);
  });

  it('asimda Retry-After basligi ve telemetri satiri uretir', async () => {
    const ctx = contextFor('user-b');
    await guard.canActivate(ctx);
    await guard.canActivate(ctx);

    const err: HttpException = await guard.canActivate(ctx).then(
      () => {
        throw new Error('429 bekleniyordu');
      },
      (e: HttpException) => e,
    );

    expect(err.getStatus()).toBe(429);
    const res = (ctx as unknown as { __res: { setHeader: jest.Mock } }).__res;
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('farkli kullanicilar birbirinin kontenjanini tuketmez', async () => {
    const a = contextFor('user-c');
    const b = contextFor('user-d');
    await guard.canActivate(a);
    await guard.canActivate(a);
    await expect(guard.canActivate(a)).rejects.toThrow(HttpException);
    await expect(guard.canActivate(b)).resolves.toBe(true);
  });

  it('llm kovasi bu guard tarafindan degerlendirilmez', async () => {
    const llmOnlyGuard = new SttRateLimitGuard(
      [{ name: 'llm', ttl: TTL_MS, limit: 0 }],
      storage,
      new Reflector(),
    );
    await llmOnlyGuard.onModuleInit();
    // limit 0 olsa bile kova adi 'stt' degilse guard devreye girmez -> true.
    await expect(llmOnlyGuard.canActivate(contextFor('user-e'))).resolves.toBe(
      true,
    );
  });
});
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `cd backend && npx jest test/unit/stt-rate-limit.spec.ts`
Expected: FAIL — modül bulunamadı

- [ ] **Step 3: Guard'ı yaz**

`backend/src/common/guards/stt-rate-limit.guard.ts`:

```ts
// DOSYA REHBERİ: Sözlü mod STT (Whisper) çağrılarında KULLANICI BAŞINA
// saatlik kota uygulayan bekçi — llm-rate-limit.guard.ts ile AYNI desen,
// AYRI kova ('stt'). LLM kotasından bağımsızdır: bir kullanıcı çok sayıda
// kayıt gönderip STT kotasını tüketse bile görüşme oluşturma/cevap gönderme
// kotası ETKİLENMEZ (ADR-0014).
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerLimitDetail,
  type ThrottlerRequest,
  seconds,
} from '@nestjs/throttler';
import { logThrottled, setRetryAfter } from './throttle-response';

// Kota iadesi (S5, llm-quota-refund.interceptor.ts) BURAYA UYGULANMAZ —
// bilinçli, spec kapsamı dışı
// (docs/superpowers/specs/2026-08-24-stt-whisper-design.md).
export class SttRateLimitGuard extends ThrottlerGuard {
  protected async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    if (requestProps.throttler.name !== STT_THROTTLER_NAME) {
      return true;
    }
    return super.handleRequest(requestProps);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = (req as { user?: { id?: string } }).user?.id;
    return userId ?? (req.ip as string);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  protected async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    setRetryAfter(context, detail.timeToBlockExpire);
    logThrottled(
      context,
      STT_THROTTLER_NAME,
      detail.limit,
      detail.timeToBlockExpire,
    );
    throw new HttpException(
      {
        message:
          'Saatlik ses cevirme sinirina ulastiniz. Lutfen daha sonra tekrar deneyin.',
        details: { retryAfterSeconds: detail.timeToBlockExpire },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export const STT_THROTTLER_NAME = 'stt';

export function sttQuota(limit: number) {
  return { [STT_THROTTLER_NAME]: { limit, ttl: seconds(3600) } };
}
```

- [ ] **Step 4: Testi tekrar çalıştır**

Run: `cd backend && npx jest test/unit/stt-rate-limit.spec.ts`
Expected: PASS (4 test)

- [ ] **Step 5: Commit**

```bash
git add backend/src/common/guards/stt-rate-limit.guard.ts backend/test/unit/stt-rate-limit.spec.ts
git commit -m "feat(transcription): stt hiz siniri kovasi (30/saat)"
```

---

### Task 7: `app.module.ts` — `stt` kovasını kaydet

**Files:**
- Modify: `backend/src/app.module.ts:53-58`

**Interfaces:**
- Consumes: `STT_THROTTLER_NAME` yerine sabit string `'stt'` kullanılır (kova kaydı `@Throttle` metadata'sıyla eşleşmek için sabit isim gerekir, döngüsel import'tan kaçınmak için string aynen yazılır — `LlmRateLimitGuard`'ın `'llm'` kovası da aynı şekilde `app.module.ts`'te yazılıdır).

- [ ] **Step 1: Throttler listesine üçüncü kovayı ekle**

`backend/src/app.module.ts` içinde `throttlers` dizisine, `llm` satırından sonra:

```ts
        throttlers: [
          { name: 'default', ttl: seconds(60), limit: 300 },
          // Yer tutucu: her LLM uc noktasi @Throttle(llmQuota(N)) ile KENDI
          // limitini verir (3/60/5 per saat — docs/API_CONVENTIONS.md 3.5).
          { name: 'llm', ttl: seconds(3600), limit: 1000 },
          // Yer tutucu: sozlu mod STT ucu @Throttle(sttQuota(30)) ile kendi
          // limitini verir (ADR-0014). LLM kovasindan bagimsiz.
          { name: 'stt', ttl: seconds(3600), limit: 1000 },
        ],
```

- [ ] **Step 2: Typecheck**

Run: `cd backend && npx tsc -p tsconfig.json --noEmit`
Expected: hata yok

- [ ] **Step 3: Mevcut throttler testlerini çalıştır (regresyon yok)**

Run: `cd backend && npx jest test/unit/llm-rate-limit.spec.ts test/unit/throttle-response.spec.ts`
Expected: PASS (dokunulmadı, ama üçüncü kova varlığı diğer guard'ları etkilememeli)

- [ ] **Step 4: Commit**

```bash
git add backend/src/app.module.ts
git commit -m "feat(transcription): app.module.ts stt kovasini kaydeder"
```

---

### Task 8: `POST /api/interviews/:id/transcribe` ucu

**Files:**
- Modify: `backend/src/interview/interview.module.ts`
- Modify: `backend/src/interview/interview.controller.ts`
- Modify: `backend/src/interview/interview.service.ts`

**Interfaces:**
- Consumes: `TranscriptionService`, `MAX_AUDIO_UPLOAD_BYTES` (Task 5), `SttRateLimitGuard`, `sttQuota` (Task 6)
- Produces: `InterviewService.languageOf(id: string): Promise<'tr' | 'en'>`, HTTP `POST /api/interviews/:id/transcribe` → `{ text: string }`

- [ ] **Step 1: `InterviewModule`'e `TranscriptionModule`'ü ekle**

`backend/src/interview/interview.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LlmModule } from '../llm/llm.module';
import { TranscriptionModule } from '../transcription/transcription.module';
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
    // ADR-0014: sozlu mod STT'si (Groq Whisper). LlmModule'den TAMAMEN
    // BAGIMSIZ bir port/adapter cifti — TranscriptionService disari acilir.
    TranscriptionModule,
    // ThrottlerModule kaydi app.module.ts'te (@Global()) — 'llm' ve 'stt'
    // kovalari + @Throttle override'lari aynen gecerlidir.
  ],
  controllers: [InterviewController],
  providers: [InterviewService, PdfExtractionService, InterviewOwnershipGuard],
})
export class InterviewModule {}
```

- [ ] **Step 2: `InterviewService`'e `languageOf` ekle**

`backend/src/interview/interview.service.ts` içinde `currentQuestionOf` metodunun hemen üstüne veya altına (aynı dosyada, ownership/existence kontrolü guard'da yapıldığı için burada tekrar edilmez):

```ts
  // ADR-0014: transcribe ucu Whisper'a dogru dil ipucunu vermek icin sadece
  // bu alani okur — findOne() gibi agir bir sorgu (questions+answer+report
  // include'u) gerekmez.
  async languageOf(id: string): Promise<'tr' | 'en'> {
    const interview = await this.prisma.interview.findUniqueOrThrow({
      where: { id },
      select: { language: true },
    });
    return interview.language;
  }
```

- [ ] **Step 3: Controller'a uç noktayı ekle**

`backend/src/interview/interview.controller.ts` — importlara ekle:

```ts
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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
```

`llmQuota` importunun yanına:

```ts
import {
  LlmRateLimitGuard,
  llmQuota,
} from '../common/guards/llm-rate-limit.guard';
import { SttRateLimitGuard, sttQuota } from '../common/guards/stt-rate-limit.guard';
```

Yapıcıya `TranscriptionService`'i ekle, `MAX_AUDIO_UPLOAD_BYTES` import et:

```ts
import { TranscriptionService, MAX_AUDIO_UPLOAD_BYTES } from '../transcription/transcription.service';
```

```ts
  constructor(
    private readonly interviewService: InterviewService,
    private readonly transcriptionService: TranscriptionService,
  ) {}
```

`§7 panel-events` bloğundan hemen önce (veya sonra) yeni metod:

```ts
  // ADR-0014: sozlu mod STT'si. LLM cagrisi DEGILDIR — 'llm' kovasindan
  // bagimsiz ayri 'stt' kovasi kullanir (docs/API_CONVENTIONS.md 3.5'e
  // dahil degil, kendi bolumu var). Kota iadesi (S5) BU UCA UYGULANMAZ.
  @Post(':id/transcribe')
  @HttpCode(HttpStatus.OK)
  @UseGuards(InterviewOwnershipGuard, SttRateLimitGuard)
  @Throttle(sttQuota(30))
  @UseInterceptors(
    FileInterceptor('audio', { limits: { fileSize: MAX_AUDIO_UPLOAD_BYTES } }),
  )
  async transcribe(
    @Param('id') id: string,
    @UploadedFile() audio: MulterFile | undefined,
  ) {
    if (!audio) throw new BadRequestException('Ses kaydi yuklenmedi.');
    // Hafif on eleme — icerikten dogrulama (PDF'teki magic-byte kontrolu
    // gibi) BILINCLI OLARAK yok: baytlar ayristirilmadan oldugu gibi Groq'a
    // iletilir, format gecerliligini saglayici zaten kontrol eder.
    if (!audio.mimetype.startsWith('audio/')) {
      throw new BadRequestException('Ses dosyasi turu desteklenmiyor.');
    }

    const language = await this.interviewService.languageOf(id);
    const result = await this.transcriptionService.transcribe(
      audio.buffer,
      audio.mimetype,
      language,
    );
    return { text: result.text };
  }
```

- [ ] **Step 4: Typecheck**

Run: `cd backend && npx tsc -p tsconfig.json --noEmit`
Expected: hata yok

- [ ] **Step 5: Mevcut interview testlerini çalıştır (regresyon yok)**

Run: `cd backend && npx jest test/unit src`
Expected: tüm testler PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/interview/interview.module.ts backend/src/interview/interview.controller.ts backend/src/interview/interview.service.ts
git commit -m "feat(transcription): POST /api/interviews/:id/transcribe ucu"
```

---

### Task 9: Test altyapısını genişlet (`fakeTranscription`)

**Files:**
- Modify: `backend/test/integration/helpers/interview-app.ts`

**Interfaces:**
- Consumes: `TRANSCRIPTION_PROVIDER` (Task 2), `FakeTranscriptionProvider` (Task 5)
- Produces: `InterviewTestApp.fakeTranscription: FakeTranscriptionProvider`

- [ ] **Step 1: Helper'ı genişlet**

`backend/test/integration/helpers/interview-app.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { HttpExceptionFilter } from '../../../src/common/http-exception.filter';
import { LLM_PROVIDER } from '../../../src/llm/llm.provider';
import { TRANSCRIPTION_PROVIDER } from '../../../src/transcription/transcription.provider';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { FakeLlmProvider } from '../../fakes/fake-llm.provider';
import { FakeTranscriptionProvider } from '../../fakes/fake-transcription.provider';

// US1..US4 (002-interview) entegrasyon testleri icin paylasilan kurulum.
// LLM_PROVIDER ve TRANSCRIPTION_PROVIDER portlari fake'lerle override edilir
// — gercek saglayiciya istek atan test YAZILMAZ (plan.md, quickstart.md On Kosullar).
export interface InterviewTestApp {
  app: INestApplication;
  prisma: PrismaService;
  fakeLlm: FakeLlmProvider;
  fakeTranscription: FakeTranscriptionProvider;
}

export async function createInterviewTestApp(): Promise<InterviewTestApp> {
  const fakeLlm = new FakeLlmProvider();
  const fakeTranscription = new FakeTranscriptionProvider();

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(LLM_PROVIDER)
    .useValue(fakeLlm)
    .overrideProvider(TRANSCRIPTION_PROVIDER)
    .useValue(fakeTranscription)
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();

  return { app, prisma: app.get(PrismaService), fakeLlm, fakeTranscription };
}
```

- [ ] **Step 2: Mevcut TÜM entegrasyon paketini çalıştır (regresyon yok — bu dosyayı onlarca test dosyası kullanır)**

Run: `cd backend && npm run test:e2e`
Expected: tüm paket PASS (yalnızca yeni bir alan eklendi, geri uyumlu)

- [ ] **Step 3: Commit**

```bash
git add backend/test/integration/helpers/interview-app.ts
git commit -m "test(transcription): interview-app helper'ina fakeTranscription eklendi"
```

---

### Task 10: Uç nokta entegrasyon testleri

**Files:**
- Create: `backend/test/integration/us8-voice-transcribe.spec.ts`

**Interfaces:**
- Consumes: `createInterviewTestApp`, `InterviewTestApp` (Task 9), `registerAndSignIn`, `fakeQuestions` (mevcut test helper'ları)

- [ ] **Step 1: Testi yaz**

`backend/test/integration/us8-voice-transcribe.spec.ts`:

```ts
import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { fakeQuestions } from './helpers/fake-questions';

// ADR-0014 — POST /api/interviews/:id/transcribe (sozlu mod STT, Groq Whisper).
describe('POST /api/interviews/:id/transcribe (ADR-0014)', () => {
  let ctx: InterviewTestApp;
  const emails: string[] = [];
  let cookies: string[];
  let interviewId: string;

  beforeAll(async () => {
    ctx = await createInterviewTestApp();
    const email = `us8-owner-${Date.now()}@example.com`;
    emails.push(email);
    cookies = await registerAndSignIn(ctx.app, ctx.prisma, email);

    ctx.fakeLlm.always({ content: fakeQuestions(5) });
    const created = await request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', cookies)
      .send({
        jobPostingSource: 'text',
        jobPostingText: 'Gecerli bir is ilani metni.',
        questionCount: 5,
        mode: 'voice',
        level: 'junior',
      });
    interviewId = (created.body.interview as { id: string }).id;
  });

  afterAll(async () => {
    await ctx.prisma.interview.deleteMany({
      where: { user: { email: { in: emails } } },
    });
    await ctx.prisma.user.deleteMany({ where: { email: { in: emails } } });
    await ctx.app.close();
  });

  function post() {
    return request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/transcribe`)
      .set('Cookie', cookies)
      .attach('audio', Buffer.from('sahte-ses-baytlari'), {
        filename: 'kayit.webm',
        contentType: 'audio/webm',
      });
  }

  it('basarili: metni doner, saglayiciya gorusme diliyle gider', async () => {
    ctx.fakeTranscription.always({ text: 'Deneyimliyim.' });

    const res = await post();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ text: 'Deneyimliyim.' });
    expect(ctx.fakeTranscription.calls.at(-1)).toMatchObject({
      mimeType: 'audio/webm',
      language: 'tr',
    });
  });

  it('audio alani eksikse 400', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/transcribe`)
      .set('Cookie', cookies);

    expect(res.status).toBe(400);
  });

  it('audio disinda bir dosya turu 400 alir', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/transcribe`)
      .set('Cookie', cookies)
      .attach('audio', Buffer.from('%PDF-1.4'), {
        filename: 'yanlislikla.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(400);
  });

  it('yabanci kullanici 404 alir (InterviewOwnershipGuard)', async () => {
    const strangerEmail = `us8-stranger-${Date.now()}@example.com`;
    emails.push(strangerEmail);
    const strangerCookies = await registerAndSignIn(
      ctx.app,
      ctx.prisma,
      strangerEmail,
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/transcribe`)
      .set('Cookie', strangerCookies)
      .attach('audio', Buffer.from('x'), {
        filename: 'kayit.webm',
        contentType: 'audio/webm',
      });

    expect(res.status).toBe(404);
  });

  it('saglayici hatasinda 502', async () => {
    ctx.fakeTranscription.always({ error: new Error('groq coktu') });

    const res = await post();

    expect(res.status).toBe(502);
  });

  it('oturumsuz istek 401 alir', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/transcribe`)
      .attach('audio', Buffer.from('x'), {
        filename: 'kayit.webm',
        contentType: 'audio/webm',
      });

    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Testi çalıştır**

Run: `cd backend && npx jest --config ./test/jest-e2e.json test/integration/us8-voice-transcribe.spec.ts`
Expected: PASS (6 test)

- [ ] **Step 3: Tam backend paketini çalıştır (regresyon yok)**

Run: `cd backend && npx jest test/unit src && npm run test:e2e`
Expected: her ikisi de tamamen PASS

- [ ] **Step 4: Commit**

```bash
git add backend/test/integration/us8-voice-transcribe.spec.ts
git commit -m "test(transcription): POST /api/interviews/:id/transcribe entegrasyon testleri"
```

---

## Frontend

### Task 11: `voice-client.ts` — saf yardımcı fonksiyonlar

**Files:**
- Modify: `frontend/src/lib/voice-client.ts`
- Modify: `frontend/test/voice-client.test.ts`

**Interfaces:**
- Produces:
  - `function computeRms(samples: Uint8Array): number`
  - `function pickSupportedMimeType(): string | undefined`
  - `function recordingSupported(): boolean`

- [ ] **Step 1: Failing testleri yaz**

`frontend/test/voice-client.test.ts` başına (dosyanın geri kalanı Task 12'de tamamen değiştirilecek — bu adımda yalnızca YENİ testleri EKLE, `startDictation` testlerine henüz dokunma):

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  computeRms,
  pickSupportedMimeType,
  recordingSupported,
} from '@/lib/voice-client'

describe('computeRms', () => {
  it('tam sessizlikte (128 = orta nokta) 0 doner', () => {
    expect(computeRms(new Uint8Array([128, 128, 128, 128]))).toBeCloseTo(0)
  })

  it('uc deger genliginde 1e yakin doner', () => {
    expect(computeRms(new Uint8Array([255, 1, 255, 1]))).toBeGreaterThan(0.9)
  })
})

describe('pickSupportedMimeType', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('MediaRecorder yoksa undefined doner', () => {
    vi.stubGlobal('MediaRecorder', undefined)
    expect(pickSupportedMimeType()).toBeUndefined()
  })

  it('desteklenen ILK adayi doner', () => {
    vi.stubGlobal('MediaRecorder', {
      isTypeSupported: (type: string) => type === 'audio/webm',
    })
    expect(pickSupportedMimeType()).toBe('audio/webm')
  })

  it('hicbir aday desteklenmiyorsa undefined doner', () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: () => false })
    expect(pickSupportedMimeType()).toBeUndefined()
  })
})

describe('recordingSupported', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getUserMedia, MediaRecorder, AudioContext HEPSI varsa true doner', () => {
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn() },
    })
    vi.stubGlobal('MediaRecorder', class {})
    vi.stubGlobal('AudioContext', class {})
    expect(recordingSupported()).toBe(true)
  })

  it('AudioContext eksikse false doner', () => {
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn() },
    })
    vi.stubGlobal('MediaRecorder', class {})
    vi.stubGlobal('AudioContext', undefined)
    expect(recordingSupported()).toBe(false)
  })

  it('getUserMedia eksikse false doner', () => {
    vi.stubGlobal('navigator', { mediaDevices: {} })
    vi.stubGlobal('MediaRecorder', class {})
    vi.stubGlobal('AudioContext', class {})
    expect(recordingSupported()).toBe(false)
  })
})
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `cd frontend && npx vitest run test/voice-client.test.ts`
Expected: FAIL — `computeRms`/`pickSupportedMimeType`/`recordingSupported` export edilmiyor

- [ ] **Step 3: `voice-client.ts` başındaki STT bölümünü değiştir**

`frontend/src/lib/voice-client.ts` — dosya başındaki yorum ve `SpeechRecognitionCtor`/`SpeechRecognitionLike`/`SpeechRecognitionEventLike`/`recognitionCtor` bloğunu SİL (Task 12'de tamamen yeni kayıt koduyla değişecek), yerine:

```ts
// Sozlu mod — ADR-0014: STT Groq Whisper (backend), TTS tarayici Web Speech
// API (ADR-0010'dan degismedi). Bu dosya iki motoru da acar: kayit
// (MediaRecorder + AnalyserNode ile ses seviyesi analizi) burada, sesli
// okuma speech/ altindan devredilir.

const CANDIDATE_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
];

/** Tarayicinin destekledigi ILK aday format — hicbiri yoksa undefined (MediaRecorder varsayilanina duser). */
export function pickSupportedMimeType(): string | undefined {
  if (
    typeof MediaRecorder === 'undefined' ||
    typeof MediaRecorder.isTypeSupported !== 'function'
  ) {
    return undefined;
  }
  return CANDIDATE_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

/**
 * Zaman-domeni orneklerinden kaba genlik (RMS). 128 = sessizlik (orta nokta,
 * unsigned byte). Donus degeri 0 (sessiz) ile ~1 (uc deger genlik) arasi.
 */
export function computeRms(samples: Uint8Array): number {
  let sumSquares = 0;
  for (const value of samples) {
    const normalized = (value - 128) / 128;
    sumSquares += normalized * normalized;
  }
  return Math.sqrt(sumSquares / samples.length);
}

export function recordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    typeof window.AudioContext !== 'undefined'
  );
}
```

`startDictation`, `DictationHandlers`, `Dictation`, `DICTATION_RESTART_DELAY_MS`, `DICTATION_RESTART_LIMIT`, `RECOVERABLE_ERRORS`, `VoiceUnsupportedError` bloklarını ŞİMDİLİK dosyada bırak — Task 12 onları kaldırıp yerine `startRecording` koyacak. `voiceSupport()`/`isSupported()` içindeki `recognitionCtor()` çağrısı da Task 12'de `recordingSupported()`'a dönecek; bu adımda dokunma (derleme hâlâ eski haliyle geçerli olsun).

- [ ] **Step 4: Testi tekrar çalıştır**

Run: `cd frontend && npx vitest run test/voice-client.test.ts`
Expected: yeni eklenen testler PASS; eski `startDictation`/`voiceSupport` testleri de HÂLÂ PASS (henüz dokunulmadı)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/voice-client.ts frontend/test/voice-client.test.ts
git commit -m "feat(voice): kayit icin saf yardimci fonksiyonlar (computeRms, pickSupportedMimeType, recordingSupported)"
```

---

### Task 12: `voice-client.ts` — `startRecording` orkestrasyonu (STT'yi Whisper'a taşı)

**Files:**
- Modify: `frontend/src/lib/voice-client.ts`
- Modify: `frontend/test/voice-client.test.ts`

**Interfaces:**
- Consumes: `pickSupportedMimeType`, `computeRms`, `recordingSupported` (Task 11)
- Produces:
  - `class MicrophoneDeniedError extends Error`
  - `class VoiceUnsupportedError extends Error` (korunur, aynı davranış)
  - `interface RecordingHandlers { onSpeechStart?(): void; onLevel?(level: number): void; onStop(blob: Blob, mimeType: string): void; onError?(error: string): void }`
  - `interface Recording { stop(): void }`
  - `function startRecording(silenceTimeoutMs: number, handlers: RecordingHandlers): Promise<Recording>`
  - `interface VoiceSupport { recognition: boolean; synthesis: boolean }` (alan adı `recognition` KORUNUR — voice-controls.tsx bunu okuyor, anlamı değişti: artık kayıt desteği)

- [ ] **Step 1: Eski `startDictation` testlerini SİL, yeni `startRecording` testlerini yaz**

`frontend/test/voice-client.test.ts` içindeki `describe('startDictation ...')` bloklarının TAMAMINI sil (SpeechRecognition tabanlı, artık geçersiz). `voiceSupport`/`isSupported` testlerini de YENİ API'ye göre güncelle. Dosyanın STT ile ilgili kısmı TAMAMEN şu hale gelir (TTS ile ilgili herhangi bir test bu dosyada YOKTUR — o `speech-queue.test.ts`/`speech-segment.test.ts`'te, dokunulmaz):

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  computeRms,
  pickSupportedMimeType,
  recordingSupported,
  voiceSupport,
  isSupported,
  startRecording,
  VoiceUnsupportedError,
  MicrophoneDeniedError,
} from '@/lib/voice-client'

// ADR-0014: sozlu mod STT'si Groq Whisper'a (backend) tasindi. Testlerde
// GERCEK tarayici API'si yok (jsdom) — MediaRecorder/getUserMedia/AudioContext
// stub'lanir.

describe('computeRms', () => {
  it('tam sessizlikte (128 = orta nokta) 0 doner', () => {
    expect(computeRms(new Uint8Array([128, 128, 128, 128]))).toBeCloseTo(0)
  })

  it('uc deger genliginde 1e yakin doner', () => {
    expect(computeRms(new Uint8Array([255, 1, 255, 1]))).toBeGreaterThan(0.9)
  })
})

describe('pickSupportedMimeType', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('MediaRecorder yoksa undefined doner', () => {
    vi.stubGlobal('MediaRecorder', undefined)
    expect(pickSupportedMimeType()).toBeUndefined()
  })

  it('desteklenen ILK adayi doner', () => {
    vi.stubGlobal('MediaRecorder', {
      isTypeSupported: (type: string) => type === 'audio/webm',
    })
    expect(pickSupportedMimeType()).toBe('audio/webm')
  })
})

// Ortak sahte MediaRecorder/AudioContext kurulumu — startRecording testleri
// bunu paylasir.
class FakeAnalyser {
  fftSize = 0
  frequencyBinCount = 4
  connect() {}
  getByteTimeDomainData(out: Uint8Array) {
    out.set(fakeLevelSamples)
  }
}

class FakeAudioContext {
  createMediaStreamSource() {
    return { connect() {} }
  }
  createAnalyser() {
    return new FakeAnalyser()
  }
  close() {
    return Promise.resolve()
  }
}

class FakeMediaRecorder {
  static isTypeSupported = () => true
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null
  mimeType = 'audio/webm'
  constructor(public stream: unknown, public opts?: unknown) {
    instances.push(this)
  }
  start() {}
  stop() {
    this.ondataavailable?.({ data: new Blob(['x'], { type: 'audio/webm' }) })
    this.onstop?.()
  }
}

let instances: FakeMediaRecorder[] = []
let fakeLevelSamples = new Uint8Array([128, 128, 128, 128]) // varsayilan: sessizlik

function stubBrowserApis() {
  instances = []
  fakeLevelSamples = new Uint8Array([128, 128, 128, 128])
  const tracks = [{ stop: vi.fn() }]
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => tracks }),
    },
  })
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
  vi.stubGlobal('AudioContext', FakeAudioContext)
  return { tracks }
}

describe('voiceSupport / isSupported (yetenek tespiti)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('kayit desteklenmiyorsa recognition:false doner', () => {
    vi.stubGlobal('navigator', { mediaDevices: {} })
    vi.stubGlobal('MediaRecorder', undefined)
    vi.stubGlobal('AudioContext', undefined)
    expect(voiceSupport().recognition).toBe(false)
    expect(isSupported()).toBe(false)
  })

  it('kayit destekleniyorsa recognition:true doner', () => {
    stubBrowserApis()
    expect(voiceSupport().recognition).toBe(true)
    expect(isSupported()).toBe(true)
  })
})

describe('startRecording', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('destekleniyorsa VoiceUnsupportedError firlatmaz, kayit baslar', async () => {
    stubBrowserApis()
    const recording = await startRecording(1000, { onStop: vi.fn() })
    expect(recording.stop).toBeInstanceOf(Function)
    expect(instances).toHaveLength(1)
  })

  it('destekleniyorsa VoiceUnsupportedError firlatir', async () => {
    vi.stubGlobal('navigator', { mediaDevices: {} })
    vi.stubGlobal('MediaRecorder', undefined)
    vi.stubGlobal('AudioContext', undefined)
    await expect(startRecording(1000, { onStop: vi.fn() })).rejects.toBeInstanceOf(
      VoiceUnsupportedError,
    )
  })

  it('mikrofon izni reddedilirse MicrophoneDeniedError firlatir', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockRejectedValue(new Error('NotAllowedError')),
      },
    })
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
    vi.stubGlobal('AudioContext', FakeAudioContext)

    await expect(startRecording(1000, { onStop: vi.fn() })).rejects.toBeInstanceOf(
      MicrophoneDeniedError,
    )
  })

  it('elle stop() cagrilinca kayit biter, onStop blob ile tetiklenir', async () => {
    stubBrowserApis()
    const onStop = vi.fn()
    const recording = await startRecording(1000, { onStop })

    recording.stop()

    expect(onStop).toHaveBeenCalledTimes(1)
    const [blob, mimeType] = onStop.mock.calls[0] as [Blob, string]
    expect(blob).toBeInstanceOf(Blob)
    expect(mimeType).toBe('audio/webm')
  })

  it('konusma sonrasi sessizlik esigi dolunca kayit KENDILIGINDEN biter', async () => {
    stubBrowserApis()
    fakeLevelSamples = new Uint8Array([255, 1, 255, 1]) // "konusma" seviyesi
    const onStop = vi.fn()
    const onSpeechStart = vi.fn()
    await startRecording(1000, { onStop, onSpeechStart })

    // Ses seviyesi dongusu 100ms'de bir kosar; konusma algilanir, sessizlik
    // sayaci KURULUR (armSilenceTimer). Sayac HER "konusma" tespitinde YENIDEN
    // kurulur — bu yuzden esik dolmadan ONCE sessizlige gecmek SART, aksi
    // halde interval sayaci surekli sifirlar ve finish() hic tetiklenmez.
    await vi.advanceTimersByTimeAsync(100)
    expect(onSpeechStart).toHaveBeenCalledTimes(1)
    expect(onStop).not.toHaveBeenCalled()

    // Aday susuyor: interval artik sessizlik olcer, sayaci BIR DAHA kurmaz.
    // En son kurulan 1000ms'lik sayac (t=100ms'de) t=1100ms'de dolar.
    fakeLevelSamples = new Uint8Array([128, 128, 128, 128]) // sessizlik
    await vi.advanceTimersByTimeAsync(1000)
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('konusma HIC algilanmazsa sessizlik sayaci hic kurulmaz, kayit surer', async () => {
    stubBrowserApis() // varsayilan: sessizlik (128,128,128,128)
    const onStop = vi.fn()
    await startRecording(1000, { onStop })

    // Uzun sure gecse de HICBIR sessizlik sayaci kurulmadi (armSilenceTimer
    // yalnizca konusma tespit edilince cagrilir) — kayit elle durdurulmadikca
    // surer (soru suresi zaten cagiran tarafta ayrica sinirlar).
    await vi.advanceTimersByTimeAsync(5000)
    expect(onStop).not.toHaveBeenCalled()
  })

  it('stop() sonrasi mikrofon KAPATILIR (track.stop cagrilir)', async () => {
    const { tracks } = stubBrowserApis()
    const recording = await startRecording(1000, { onStop: vi.fn() })

    recording.stop()

    expect(tracks[0].stop).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `cd frontend && npx vitest run test/voice-client.test.ts`
Expected: FAIL — `startRecording`/`MicrophoneDeniedError` export edilmiyor, `voiceSupport` hâlâ eski `recognitionCtor`'a bakıyor

- [ ] **Step 3: `voice-client.ts`'i tamamla — eski STT bloğunu kaldır, yenisini yaz**

`frontend/src/lib/voice-client.ts` — `startDictation`, `DictationHandlers`, `Dictation`, `DICTATION_RESTART_*`, `RECOVERABLE_ERRORS` bloklarının TAMAMINI SİL. `VoiceUnsupportedError` KALIR (mesajı aynı). `voiceSupport()`/`isSupported()`'ı Task 11'de eklenen `recordingSupported()`'ı kullanacak şekilde güncelle. Dosyanın STT bölümü (TTS re-export'ları `speak`/`stopSpeaking`/`hasVoiceFor`/`loadVoices` AYNEN kalır, dosyanın sonunda) son hâliyle:

```ts
export interface VoiceSupport {
  /** Konusma -> metin (Whisper'a kayit gonderme). Sozlu mod icin ZORUNLU. */
  recognition: boolean;
  /** Metin -> konusma (sorunun sesli okunmasi). Yoksa mod yine calisir. */
  synthesis: boolean;
}

export function voiceSupport(): VoiceSupport {
  return {
    recognition: recordingSupported(),
    synthesis: typeof window !== 'undefined' && 'speechSynthesis' in window,
  };
}

/** FR-025: cagiran bunu false gorurse sozlu mod secenegini devre disi birakir. */
export function isSupported(): boolean {
  return voiceSupport().recognition;
}

export class VoiceUnsupportedError extends Error {
  constructor() {
    super('Bu tarayici sesli girisi desteklemiyor.');
    this.name = 'VoiceUnsupportedError';
  }
}

export class MicrophoneDeniedError extends Error {
  constructor() {
    super('Mikrofon izni reddedildi.');
    this.name = 'MicrophoneDeniedError';
  }
}

export interface RecordingHandlers {
  /** GERCEK ses seviyesi algilandi (esik ustunde) — startDictation'daki
   *  onSpeechStart ile AYNI amac: sessizlik sayaci ancak BUNDAN SONRA anlamli. */
  onSpeechStart?(): void;
  /** Kayit surerken ANLIK ses seviyesi (0-1 kaba genlik) — kayit gostergesi icin. */
  onLevel?(level: number): void;
  /** Sessizlik esigi asildi VEYA stop() cagrildi: kayit bitti, blob HAZIR (Whisper'a yuklenmeye hazir). */
  onStop(blob: Blob, mimeType: string): void;
  onError?(error: string): void;
}

export interface Recording {
  /** Elle durdurma (kullanici "Kaydi Durdur" butonuna bastiginda). */
  stop(): void;
}

// Kaba genlik esigi — bunun USTU "konusma", ALTI "sessizlik" sayilir.
const SPEECH_LEVEL_THRESHOLD = 0.02;
// Ses seviyesi ne siklikta olculur (ms). RequestAnimationFrame yerine sabit
// interval: testlerde sahte zamanlayicilarla (vi.useFakeTimers) deterministik.
const LEVEL_POLL_MS = 100;

/**
 * Mikrofon kaydini baslatir; VOICE_SILENCE_TIMEOUT_MS kadar sessizlik
 * (startDictation ile AYNI sabit, cagiran taraftan gelir) sonrasi kayit
 * KENDILIGINDEN durur ve onStop tetiklenir. Whisper TOPLU calisir (ADR-0014):
 * canli/akan metin YOKTUR, yalnizca ses seviyesi (onLevel) anlik gorunur.
 */
export async function startRecording(
  silenceTimeoutMs: number,
  handlers: RecordingHandlers,
): Promise<Recording> {
  if (!recordingSupported()) throw new VoiceUnsupportedError();

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    throw new MicrophoneDeniedError();
  }

  const mimeType = pickSupportedMimeType();
  const recorder = new MediaRecorder(
    stream,
    mimeType ? { mimeType } : undefined,
  );
  const chunks: BlobPart[] = [];
  let stopped = false;
  let silenceTimer: number | undefined;
  let hasSpoken = false;

  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  const samples = new Uint8Array(analyser.frequencyBinCount);

  const clearSilenceTimer = () => {
    if (silenceTimer !== undefined) {
      window.clearTimeout(silenceTimer);
      silenceTimer = undefined;
    }
  };

  const armSilenceTimer = () => {
    clearSilenceTimer();
    silenceTimer = window.setTimeout(finish, silenceTimeoutMs);
  };

  const teardown = () => {
    window.clearInterval(levelInterval);
    clearSilenceTimer();
    stream.getTracks().forEach((track) => track.stop());
    void audioCtx.close();
  };

  function finish() {
    if (stopped) return;
    stopped = true;
    teardown();
    recorder.stop();
  }

  const levelInterval = window.setInterval(() => {
    analyser.getByteTimeDomainData(samples);
    const level = computeRms(samples);
    handlers.onLevel?.(level);
    if (level > SPEECH_LEVEL_THRESHOLD) {
      if (!hasSpoken) {
        hasSpoken = true;
        handlers.onSpeechStart?.();
      }
      armSilenceTimer();
    }
  }, LEVEL_POLL_MS);

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.onstop = () => {
    const finalType = recorder.mimeType || mimeType || 'audio/webm';
    handlers.onStop(new Blob(chunks, { type: finalType }), finalType);
  };
  recorder.onerror = () => {
    if (stopped) return;
    stopped = true;
    teardown();
    handlers.onError?.('recording-failed');
  };

  recorder.start();

  return { stop: finish };
}
```

`recordingSupported`/`pickSupportedMimeType`/`computeRms` (Task 11'de eklendi) dosyanın ÜSTÜNDE, bu blok ONLARDAN SONRA, `speak`/`stopSpeaking`/`hasVoiceFor`/`loadVoices` re-export'ları EN SONDA — dosyanın sırası budur, hiçbiri silinmez.

- [ ] **Step 4: Testi tekrar çalıştır**

Run: `cd frontend && npx vitest run test/voice-client.test.ts`
Expected: PASS (tüm testler)

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc -b`
Expected: hata yok (bu adım `voice-controls.tsx` henüz güncellenmediği için BAŞARISIZ OLABİLİR — `startDictation`/`Dictation` artık export edilmiyor. Hata `voice-controls.tsx`'i işaret ediyorsa BEKLENEN durum, Task 14'te düzelecek. Başka bir dosyada hata varsa dur ve düzelt.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/voice-client.ts frontend/test/voice-client.test.ts
git commit -m "feat(voice): STT SpeechRecognition yerine MediaRecorder tabanli kayit (ADR-0014)"
```

---

### Task 13: `interview-client.ts` — `transcribeAudio()`

**Files:**
- Modify: `frontend/src/lib/interview-client.ts`

**Interfaces:**
- Produces: `function transcribeAudio(interviewId: string, blob: Blob, mimeType: string): Promise<{ text: string }>`

- [ ] **Step 1: Fonksiyonu ekle**

`frontend/src/lib/interview-client.ts` içinde `submitAnswer`'dan hemen sonra:

```ts
// ADR-0014 — sozlu mod STT'si (Groq Whisper, backend). Blob dosya adi
// onemsiz (backend uzantiyi mimeType'tan cikarir); alan adi backend'deki
// FileInterceptor('audio') ile ESLESMELIDIR.
export async function transcribeAudio(
  interviewId: string,
  blob: Blob,
  mimeType: string,
) {
  const form = new FormData();
  form.set('audio', blob, `kayit.${mimeType.split('/')[1]?.split(';')[0] ?? 'webm'}`);

  const res = await fetch(
    `${API_URL}/api/interviews/${interviewId}/transcribe`,
    { method: 'POST', credentials: 'include', body: form },
  );

  return parse<{ text: string }>(res);
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc -b`
Expected: `interview-client.ts` için hata yok (voice-controls.tsx hatası Task 12'den beklenen, sürüyor)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/interview-client.ts
git commit -m "feat(voice): interview-client.ts transcribeAudio() (ADR-0014)"
```

---

### Task 14: `voice-controls.tsx` — faz makinesini yeni kayda bağla

**Files:**
- Modify: `frontend/src/components/interview/voice-controls.tsx`
- Modify: `frontend/test/voice-controls.test.tsx`

**Interfaces:**
- Consumes: `startRecording`, `Recording`, `RecordingHandlers`, `MicrophoneDeniedError`, `VoiceUnsupportedError` (Task 12), `transcribeAudio` (Task 13)
- Produces: `VoiceControls` bileşeni yeni prop `interviewId: string` alır; `Phase` tipine `'transcribing'` eklenir

- [ ] **Step 1: Mevcut testi oku ve güncellemeye hazırla**

`frontend/test/voice-controls.test.tsx` dosyasını aç. Testler şu anda `window.SpeechRecognition`'ı sahteler ve `onresult`/`onend` olaylarını simüle eder. Bu deseni Task 12'deki `stubBrowserApis()` benzeri bir `MediaRecorder`/`getUserMedia`/`AudioContext` sahtesine çevir — Task 12'nin `voice-client.test.ts` içindeki `FakeMediaRecorder`/`FakeAudioContext`/`stubBrowserApis` bloğunu BİREBİR bu dosyaya da kopyala (iki dosya arasında paylaşılan bir yardımcı dosya YARATMA — ponytail: iki kopya, tek yardımcı dosyadan daha az soyutlama riski taşır ve testler birbirinden bağımsız okunabilir kalır).

Testlerin kapsaması gereken senaryolar (her biri ayrı `it`):
1. Soru okunduktan sonra otomatik akışta kayıt başlar (`'listening'` fazı).
2. Kayıt bitince (`onStop`) `'transcribing'` fazına geçilir, `transcribeAudio` çağrılır.
3. `transcribeAudio` başarılı dönerse metin `onChange` ile cevaba eklenir, faz `'reviewing'` olur.
4. `transcribeAudio` hata döndürürse hata mesajı gösterilir VE `onFallbackToWritten()` çağrılır (spec kararı: STT hatası da mikrofon izni reddiyle AYNI fallback yolunu kullanır).
5. `MicrophoneDeniedError` fırlarsa `onFallbackToWritten()` çağrılır (mevcut davranış korunur).
6. Tarayıcı desteklenmiyorsa (`recordingSupported() === false`) `voiceControls.notSupportedFallback` metni gösterilir (mevcut davranış, `recognition` alanı üzerinden — değişmedi).

Bu testleri `vi.mock('@/lib/interview-client', () => ({ transcribeAudio: vi.fn() }))` ile `transcribeAudio`'yu sahteleyerek yaz — gerçek `fetch` çağrılmaz.

- [ ] **Step 2: Testi çalıştır, başarısız olduğunu doğrula**

Run: `cd frontend && npx vitest run test/voice-controls.test.tsx`
Expected: FAIL (bileşen henüz eski `startDictation`'ı kullanıyor, yeni prop/davranış yok)

- [ ] **Step 3: `voice-controls.tsx`'i güncelle**

Değişiklikler (dosyanın geri kalanı — JSX yapısı, `autoFlow`, soru okuma `useEffect`'i — AYNEN kalır, yalnızca aşağıdakiler değişir):

`import` bloğu:

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  startRecording,
  speak,
  stopSpeaking,
  voiceSupport,
  hasVoiceFor,
  loadVoices,
  MicrophoneDeniedError,
  type Recording,
  type SpeechHandle,
} from '@/lib/voice-client'
import { transcribeAudio } from '@/lib/interview-client'
import { buildPreQuestionSpeech } from '@/lib/speech/interview-script'
import {
  QUESTION_TIME_LIMIT_SECONDS,
  VOICE_SILENCE_TIMEOUT_MS,
  VOICE_MIC_WARMUP_MS,
} from '@/lib/interview-config'
import i18n from '@/lib/i18n'
import { useTranslation } from '@/lib/i18n/language-provider'
```

`Phase` tipi:

```ts
type Phase = 'speaking' | 'listening' | 'transcribing' | 'reviewing' | 'idle'
```

Prop listesine `interviewId` ekle:

```ts
export function VoiceControls({
  interviewId,
  questionText,
  questionOrder,
  questionCount,
  position,
  language,
  interviewerRemark,
  value,
  onChange,
  onSpeechComplete,
  onFallbackToWritten,
}: {
  interviewId: string
  questionText: string
  questionOrder: number
  questionCount: number
  position: string | null
  language: 'tr' | 'en'
  interviewerRemark: string | null
  value: string
  onChange: (text: string) => void
  onSpeechComplete: () => void
  onFallbackToWritten: () => void
}) {
```

`dictationRef`/`interim` state'ini `recordingRef`/`level` ile değiştir:

```ts
  const recordingRef = useRef<Recording | null>(null)
  const speechRef = useRef<SpeechHandle | null>(null)
  const micStartTimerRef = useRef<number | null>(null)
  const valueRef = useRef(value)
  const autoFlowRef = useRef(autoFlow)
  const onSpeechCompleteRef = useRef(onSpeechComplete)
  const [phase, setPhase] = useState<Phase>('idle')
  const [autoFlow, setAutoFlow] = useState(true)
  const [error, setError] = useState('')
  // Canli metin YOK (Whisper toplu calisir) — yalnizca ses seviyesi (0-1),
  // kayit gostergesi icin.
  const [level, setLevel] = useState(0)
  const [voiceMissing, setVoiceMissing] = useState(false)
```

(`silenceTimerRef`/`clearSilenceTimer` KALDIRILIR — sessizlik zamanlayıcısı
artık `voice-client.ts` içinde, `startRecording`'in kendi sorumluluğunda.
`micStartTimerRef`/`clearMicStartTimer` AYNEN KALIR — bu, TTS bitip mikrofon
açılmadan önceki bekleme (`VOICE_MIC_WARMUP_MS`) için, STT motorundan
BAĞIMSIZ. `clearMicStartTimer`'ın tanımı değişmez:

```ts
  const clearMicStartTimer = useCallback(() => {
    if (micStartTimerRef.current !== null) {
      window.clearTimeout(micStartTimerRef.current)
      micStartTimerRef.current = null
    }
  }, [])
```
)

`stopListening` → `stopRecording` olarak yeniden adlandır (orijinali hem
sessizlik zamanlayıcısını hem mikrofon-açma zamanlayıcısını temizliyordu;
birincisi artık `voice-client.ts`'te, ikincisi AYNEN kalır):

```ts
  const stopRecording = useCallback(() => {
    clearMicStartTimer()
    setLevel(0)
    recordingRef.current?.stop()
    recordingRef.current = null
  }, [clearMicStartTimer])
```

`beginListening`'i tamamen değiştir:

```ts
  const beginListening = useCallback(() => {
    setError('')
    setLevel(0)

    startRecording(VOICE_SILENCE_TIMEOUT_MS, {
      onSpeechStart: () => {
        // Whisper toplu calistigi icin burada yapilacak bir sey yok; sadece
        // startDictation ile AYNI kavramsal ani (konusma ALGILANDI) tasir.
      },
      onLevel: setLevel,
      onStop: (blob, mimeType) => {
        setLevel(0)
        recordingRef.current = null
        setPhase('transcribing')
        transcribeAudio(interviewId, blob, mimeType)
          .then(({ text }) => {
            onChange(`${valueRef.current} ${text}`.trim())
            setPhase('reviewing')
          })
          .catch(() => {
            // Spec karari (2026-08-24): STT hatasi mikrofon izni reddiyle
            // AYNI yoldan gecer — hata goster + yaziliya dus, otomatik
            // yeniden deneme YOK.
            setError(t('voiceControls.voiceError'))
            setPhase('idle')
            onFallbackToWritten()
          })
      },
      onError: () => {
        setError(t('voiceControls.voiceError'))
        setPhase('idle')
      },
    })
      .then((recording) => {
        recordingRef.current = recording
        setPhase('listening')
      })
      .catch((err: unknown) => {
        setPhase('idle')
        if (err instanceof MicrophoneDeniedError) {
          setError(t('voiceControls.micDenied'))
          onFallbackToWritten()
        } else {
          setError(t('voiceControls.notSupported'))
          onFallbackToWritten()
        }
      })
  }, [interviewId, onChange, onFallbackToWritten, t])
```

Soru okuma `useEffect`'i içinde `stopListening()` çağrılarını `stopRecording()` ile değiştir (iki yerde: efekt başında ve cleanup'ta). `onEnd` içindeki mikrofon açma zamanlayıcısı AYNEN kalır (`beginListening()` çağrısı değişmedi, yalnızca içi değişti).

JSX'te `phase === 'listening'` bloğundaki canlı metin (`interim`) gösterimini kayıt göstergesine çevir:

```tsx
      {phase === 'listening' && (
        <div className="flex flex-col gap-1">
          <p
            aria-live="polite"
            className="min-h-5 text-sm italic text-[var(--color-text-muted)]"
          >
            {t('voiceControls.listeningHint')}
          </p>
          {/* Ses seviyesi gostergesi — Whisper toplu calistigi icin canli
              metin YOK; kullanici mikrofonun GERCEKTEN duydugunu bu barla
              gorur (FR-025 ile ayni gerekce: calismayan/sessizce bekleyen
              mikrofon ayirt edilebilir olmali). */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
            <div
              className="h-full bg-[var(--color-danger)] transition-[width] duration-100"
              style={{ width: `${Math.min(100, level * 400)}%` }}
            />
          </div>
        </div>
      )}

      {phase === 'transcribing' && (
        <p
          aria-live="polite"
          className="text-sm italic text-[var(--color-text-muted)]"
        >
          {t('voiceControls.transcribing')}
        </p>
      )}
```

Aşağıdaki buton `onClick`'inde `stopListening`/`beginListening` çağrılarını
`stopRecording`/`beginListening` ile güncelle, VE `disabled` ekle —
`'transcribing'` fazında butona basılırsa `else` dalı yeni bir kayıt
başlatırdı, hâlâ süren bir Whisper isteğiyle yarış durumu yaratırdı
(orijinal kodda bu faz yoktu, bu yüzden bu koruma da yoktu):

```tsx
        <button
          type="button"
          disabled={phase === 'transcribing'}
          onClick={() => {
            if (phase === 'listening') {
              stopRecording()
              setPhase('transcribing')
            } else {
              speechRef.current?.cancel()
              clearMicStartTimer()
              beginListening()
            }
          }}
```

Butonun `className`'ine diğer `disabled` kullanılan butonla (aşağıdaki "Soruyu
Tekrar Oku") AYNI `disabled:opacity-50` sınıfını ekle (şu an bu butonda
`disabled:` varyantı yok, opasite değişmez ama tıklama engellenir — görsel
tutarlılık için ekle):

```tsx
          className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium transition-colors hover:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
```

Not: elle "Kaydı Durdur"a basıldığında da `onStop` handler'ı (Whisper'a yükleme) tetiklenir çünkü `recording.stop()` içeride `recorder.stop()`'u çağırır ve bu `onstop` → `handlers.onStop` zincirini başlatır — yani `setPhase('transcribing')` burada UI'ı hemen günceller, asıl faz geçişi (`'reviewing'`'e) `onStop` içindeki `transcribeAudio` sonucundan gelir. Checkbox (`autoFlow` kapatma) handler'ındaki `stopListening()` çağrısını da `stopRecording()` yap, `setPhase('reviewing')` yerine `setPhase('transcribing')` YAZMA — orada zaten `onStop` akışı fazı yönetecek, elle `'reviewing'` YAZMAK yarış durumu yaratır. O bloğu şöyle güncelle:

```tsx
          onChange={(event) => {
            const next = event.target.checked
            setAutoFlow(next)
            if (!next && phase === 'listening') {
              stopRecording()
              setPhase('transcribing')
            }
          }}
```

- [ ] **Step 4: Çeviri anahtarlarını ekle**

`frontend/src/lib/i18n/locales/tr/interview.json` ve `frontend/src/lib/i18n/locales/en/interview.json` içindeki `voiceControls.status` nesnesine `"transcribing"` ekle (`"speaking"`/`"listening"`/`"reviewing"`/`"idle"` ile aynı yerde), ve üst seviyeye `"transcribing"` metni ekle:

TR: `"transcribing": "Ses metne cevriliyor..."`
EN: `"transcribing": "Transcribing audio..."`

`voiceControls.status.transcribing` için de aynı metni ekle (status etiketi `t(\`voiceControls.status.${phase}\`)` ile okunuyor, `phase` artık `'transcribing'` değerini alabiliyor).

- [ ] **Step 5: `session.tsx`'te `interviewId` prop'unu geç**

`frontend/src/pages/interview/session.tsx` içinde `<VoiceControls` açılışına, `questionText` satırından ÖNCE:

```tsx
            <VoiceControls
              interviewId={id!}
              questionText={question.text}
```

- [ ] **Step 6: Testi tekrar çalıştır**

Run: `cd frontend && npx vitest run test/voice-controls.test.tsx`
Expected: PASS (tüm senaryolar)

- [ ] **Step 7: Typecheck**

Run: `cd frontend && npx tsc -b`
Expected: hata yok

- [ ] **Step 8: İlgili diğer frontend testlerini çalıştır (regresyon yok)**

Run: `cd frontend && npx vitest run test/voice-client.test.ts test/voice-controls.test.tsx test/speech-segment.test.ts test/speech-queue.test.ts test/question-card-voice.test.tsx`
Expected: tümü PASS

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/interview/voice-controls.tsx frontend/test/voice-controls.test.tsx frontend/src/lib/i18n/locales/tr/interview.json frontend/src/lib/i18n/locales/en/interview.json frontend/src/pages/interview/session.tsx
git commit -m "feat(voice): voice-controls.tsx Whisper tabanli kayda baglandi (ADR-0014)"
```

---

### Task 15: E2E — tarayıcı-desteksizlik simülasyonu Whisper API'lerine güncellenir

**Files:**
- Modify: `frontend/test/e2e/interview-flows.spec.ts:46-56` (`stubVoiceUnsupported`)

**Interfaces:**
- Consumes: `recordingSupported()`'ın kontrol ettiği globaller (Task 11: `getUserMedia`, `window.MediaRecorder`, `window.AudioContext`)

`stubVoiceUnsupported` GERÇEK bir Playwright tarayıcısında (Chromium)
çalışır — jsdom değil, yani `MediaRecorder`/`AudioContext` varsayılan olarak
VARDIR. Yalnızca `SpeechRecognition`'ı silmek artık `recordingSupported()`'ı
`false` yapmaz (o fonksiyon `SpeechRecognition`'a hiç bakmıyor); test S6
sessizce anlamsızlaşırdı (sözlü mod hâlâ etkin görünürdü, senaryo hiç
tetiklenmezdi).

- [ ] **Step 1: `stubVoiceUnsupported`'ı güncelle**

`frontend/test/e2e/interview-flows.spec.ts` içinde:

```ts
/** ADR-0014: tarayici destegi olmadigi durumu simule eder (FR-025). STT artik
 *  MediaRecorder+getUserMedia+AudioContext'e bagli (SpeechRecognition'a DEGIL);
 *  ucu silmek yeterli — recordingSupported() ucunun HEPSINI arar. */
async function stubVoiceUnsupported(page: Page) {
  await page.addInitScript(() => {
    // @ts-expect-error test stub
    delete window.MediaRecorder
    // @ts-expect-error test stub
    delete window.AudioContext
    // @ts-expect-error test stub
    delete window.speechSynthesis
  })
}
```

- [ ] **Step 2: Testi çalıştır (yerel tarayıcı kuruluysa)**

Run: `cd frontend && npx playwright test test/e2e/interview-flows.spec.ts -g "SpeechRecognition YOKSA"`
Expected: PASS. Yerel ortamda Playwright tarayıcıları kurulu değilse
(`npx playwright install` gerekir) bu adım atlanabilir — zorunlu değildir,
zincirin geri kalanı buna bağlı değil.

- [ ] **Step 3: Commit**

```bash
git add frontend/test/e2e/interview-flows.spec.ts
git commit -m "test(voice): e2e tarayici-destegi-yok simulasyonu MediaRecorder/AudioContext'e guncellendi"
```

---

## Dokümantasyon

### Task 16: ADR-0014, ADR-0010 güncellemesi, TECH_STACK.md, `.env.example`

**Files:**
- Modify: `docs/DECISIONS.md`
- Modify: `docs/TECH_STACK.md`
- Modify: `Group-4/.env.example`

**Interfaces:**
- Yok (yalnızca dokümantasyon)

- [ ] **Step 1: ADR tablosuna satır ekle**

`docs/DECISIONS.md` başındaki ADR tablosunda `ADR-0013` satırından sonra:

```
| ADR-0014 | Sözlü mod STT: Groq Whisper (tarayıcı yerine, TTS aynen kalır) | ✅ Kabul | `docs/superpowers/specs/2026-08-24-stt-whisper-design.md` |
```

- [ ] **Step 2: ADR-0010'un durumunu güncelle**

`docs/DECISIONS.md` içinde `## ADR-0010 — Sözlü Mod Altyapısı: Tarayıcı Web Speech API` başlığının hemen altındaki `- **Durum:** ✅ Kabul edildi` satırını:

```
- **Durum:** ⛔ Kısmen değiştirildi (STT → ADR-0014, TTS aynen kalır)
```

Metnin geri kalanı SİLİNMEZ (repo konvansiyonu — bkz. ADR-0006).

- [ ] **Step 3: Yeni ADR-0014 bölümünü ekle**

`docs/DECISIONS.md` sonuna (son ADR'den sonra):

```markdown
---

## ADR-0014 — Sözlü Mod STT: Groq Whisper

- **Tarih:** 2026-08-24
- **Durum:** ✅ Kabul edildi
- **Sahibi:** brainstorming diyaloğu (bkz. `docs/superpowers/specs/2026-08-24-stt-whisper-design.md`)

### Bağlam

ADR-0010, sözlü modun STT ve TTS ikisini de tarayıcı Web Speech API ile
çözdüğüne karar vermişti; kayıtlı risk R2 "Türkçe transkript hataları"ydı,
mitigasyonu "kullanıcı gönderim öncesi metni görüp düzeltebilir"di. Bu ADR o
riski mitigasyonla değil kaynağında çözüyor: **yalnızca STT** tarafı
tarayıcıdan alınıp Groq Whisper'a taşınıyor. **TTS aynen kalıyor.**

### Karar

**Sözlü modun STT kısmı Groq Whisper (`whisper-large-v3-turbo`) ile
uygulanır.** İstemci `MediaRecorder`+`getUserMedia` ile ses kaydeder, ses
seviyesi analiziyle (`AnalyserNode`) otomatik durur, kayıt backend'e
yüklenir (`POST /api/interviews/:id/transcribe`), backend Groq'a iletir ve
dönen metni geri verir. Whisper TOPLU çalışır — canlı/akan transkript YOK,
kullanıcı yalnızca kayıt sırasında ses seviyesi göstergesi görür, metin
kayıt bitince gelir. TTS (`SpeechSynthesis`) DEĞİŞMEDİ.

### Değerlendirilen Alternatifler

| Eksen | A) Groq Whisper (SEÇİLEN) | B) Tarayıcı STT (mevcut, ADR-0010) | C) Whisper başarısızsa tarayıcıya otomatik düş |
|-------|---------------------------|--------------------------------------|--------------------------------------------------|
| **Türkçe kalitesi** | Yüksek (motivasyon) | Tarayıcıya göre değişken | Yüksek (çoğu durumda) |
| **Maliyet** | Groq ücretsiz katman (gerçek harcama $0, liste fiyatı raporlama için — ADR-0007 ile aynı desen) | Sıfır | Sıfır + ücretsiz katman |
| **Karmaşıklık** | Orta — yeni backend ucu + kota, `MediaRecorder` tabanlı kayıt | Yok | Yüksek — iki motor da kodda tutulur |
| **Tarayıcı bağımlılığı** | Düşük (`MediaRecorder`/`getUserMedia` Firefox/Safari'de de var) | Yüksek (`SpeechRecognition` yok) | Düşük (yan fayda + garanti) |
| **Kota riski** | Var (Groq ücretsiz katman, ADR-0007 R1 ile aynı desen); ayrı `stt` kovasıyla ilk savunma katmanı | Yok | Var, iki kat karmaşıklıkla |

### Gerekçe (Belirleyici Eksen: Türkçe Kalitesi)

ADR-0010'un R2 riski gerçek: transkript hatası doğrudan LLM girdisine gider
ve rapor kalitesini bozar. Kullanıcı düzeltebilse de bu bir MİTİGASYONDUR,
kaynağı çözmez. Groq zaten ADR-0007'nin LLM sağlayıcısı — aynı ekosistemde
ikinci bir entegrasyon (ayrı hesap/fatura yok), ücretsiz katmanı var.

C) (otomatik motor değişimi) reddedildi: iki motoru aynı anda kodda tutmak
karmaşıklığı ikiye katlıyor, kazancı marjinal (Whisper zaten Groq'un kendi
ücretsiz katmanında çalışıyor, başarısızlık nadir olmalı).

### Riskler ve Azaltma

| # | Risk | Azaltma |
|---|------|---------|
| R1 | Groq Whisper ücretsiz katman kota tavanı (ADR-0007 TPM riskiyle aynı desen) | Kullanıcı başına `stt` kovası (30/saat) ilk savunma katmanı; sağlayıcı 429 dönerse kullanıcı yazılıya düşer |
| R2 | Mikrofon izni / `MediaRecorder` desteği yok | `voiceSupport()` kontrolü — desteklenmiyorsa sözlü mod UI'da devre dışı (FR-025, sessiz başarısızlık yok) |
| R3 | `GROQ_API_KEY` yapılandırılmamış | Sağlayıcı hatasıyla AYNI yoldan geçer (bilinçli, ayrı bir durum eklenmedi) |

### Sonuçlar / Etkiler

- `docs/TECH_STACK.md` → "Voice / Speech" satırı güncellendi.
- Yeni env: `GROQ_API_KEY` (opsiyonel).
- Sesli akış için artık bir maliyet/kota YÜZEYİ var (LLM'den bağımsız);
  kalıcı maliyet KAYDI yok (bilinçli, spec kapsamı dışı — istenirse ayrı iş).
- Sunucu tarafı `POST /api/interviews/:id/answers` sözleşmesi DEĞİŞMEDİ —
  transkript istemcide `content` alanına yazılıp normal cevap gibi gönderilir.
```

- [ ] **Step 4: `TECH_STACK.md` satırını güncelle**

`docs/TECH_STACK.md` içindeki:

```
| Voice / Speech (STT-TTS) | **Tarayıcı Web Speech API** — istemci tarafı, sunucuda ses işleme yok (ADR-0010) | tarayıcı yerleşik |
```

satırını:

```
| Voice / Speech (STT-TTS) | **STT: Groq Whisper** (`whisper-large-v3-turbo`, backend — ADR-0014) · **TTS: Tarayıcı Web Speech API** (istemci, ADR-0010) | `openai` SDK (Groq uyumlu) |
```

ile değiştir.

- [ ] **Step 5: `.env.example`'a `GROQ_API_KEY` ekle**

`Group-4/.env.example` içinde `LLM_API_KEY=""` satırından sonra:

```
# ADR-0014: sozlu mod STT'si (Groq Whisper). LLM_API_KEY'den BAGIMSIZ —
# LLM_PROVIDER "deepseek" olsa bile STT hep Groq'tan gelir. Bos birakilirsa
# sozlu modun STT kismi calismaz (hata + yaziliya dusme, ayri bir
# "yapilandirilmamis" mesaji yoktur).
GROQ_API_KEY=""
```

- [ ] **Step 6: Commit**

```bash
git add docs/DECISIONS.md docs/TECH_STACK.md Group-4/.env.example
git commit -m "docs: ADR-0014 (Groq Whisper STT), ADR-0010 kismi degistirme, TECH_STACK.md"
```

---

## Bitiş Doğrulaması

- [ ] **Backend tam paket:** `cd backend && npx tsc -p tsconfig.json --noEmit && npx jest test/unit src && npm run test:e2e`
- [ ] **Frontend tam paket:** `cd frontend && npx tsc -b && npx vitest run`
- [ ] **Lint (dokunulan dosyalar):** `cd backend && npx eslint src/transcription src/common/guards/stt-rate-limit.guard.ts src/interview/interview.controller.ts src/interview/interview.module.ts src/interview/interview.service.ts src/app.module.ts`
- [ ] **Manuel duman testi (opsiyonel, gerçek Groq anahtarı varsa):** `GROQ_API_KEY` doldurulmuş `.env` ile `npm run start:dev`, sözlü modda bir görüşme başlat, mikrofona konuş, metnin doğru geldiğini doğrula.
