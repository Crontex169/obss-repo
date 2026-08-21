import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageService } from '@nestjs/throttler';
import { lastValueFrom, of, throwError } from 'rxjs';
import { LlmQuotaRefundInterceptor } from '../../src/common/llm-quota-refund.interceptor';
import {
  LLM_QUOTA_KEY,
  LlmRateLimitGuard,
} from '../../src/common/guards/llm-rate-limit.guard';
import { createThrottlerStorage } from '../../src/common/throttler-storage';
import {
  LlmProviderError,
  LlmSchemaError,
  LlmTimeoutError,
} from '../../src/llm/llm.errors';

// S5 — saglayici cokerse kullanici hicbir sey almadan kotasindan hak
// kaybetmemelidir. Kota istek ONCESI tuketilir (kotuye kullanim icin dogru
// karar); iade, yalnizca hatanin kullanicinin girdisinden DEGIL saglayicidan
// geldigi durumda yapilir.
const REDIS_URL = process.env.REDIS_URL;

function contextWithKey(key?: string): ExecutionContext {
  const req: Record<string | symbol, unknown> = { method: 'POST' };
  if (key) req[LLM_QUOTA_KEY] = key;
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

const nextThrowing = (error: unknown) => ({
  handle: () => throwError(() => error),
});

async function runAndCatch(
  interceptor: LlmQuotaRefundInterceptor,
  context: ExecutionContext,
  error: unknown,
): Promise<unknown> {
  return lastValueFrom(
    interceptor.intercept(context, nextThrowing(error)),
  ).then(
    () => {
      throw new Error('hata bekleniyordu');
    },
    (e: unknown) => e,
  );
}

describe('LlmQuotaRefundInterceptor — hata siniflandirmasi', () => {
  // Bellek deposu: iade YAPILMAZ ama akis bozulmamalidir.
  const memory = new ThrottlerStorageService();
  const interceptor = new LlmQuotaRefundInterceptor(memory);

  afterAll(() => memory.onApplicationShutdown());

  it('basarili yanit degistirilmez', async () => {
    const out = await lastValueFrom(
      interceptor.intercept(contextWithKey('k'), { handle: () => of('ok') }),
    );
    expect(out).toBe('ok');
  });

  it('hata AYNEN yukari gider (iade yan etkidir, yanit degil)', async () => {
    const error = new LlmProviderError();
    const caught = await runAndCatch(interceptor, contextWithKey('k'), error);
    expect(caught).toBe(error);
  });

  it('bellek deposunda iade denenmez ama istek bozulmaz', async () => {
    // Bellek deposunda her isabetin kendi zamanlayicisi vardir; elle dusurmek
    // sayaci eksiye tasir. Sessizce yanlis davranmaktansa iade yapilmaz.
    const caught = await runAndCatch(
      interceptor,
      contextWithKey('k'),
      new LlmTimeoutError(),
    );
    expect(caught).toBeInstanceOf(LlmTimeoutError);
  });
});

(REDIS_URL ? describe : describe.skip)(
  'LlmQuotaRefundInterceptor — Redis uzerinde gercek iade',
  () => {
    const TTL_MS = 60_000;
    const LIMIT = 3;
    // Redis destekli deponun testte kullanilan yuzu — `any` yerine dar tip.
    type RedisBackedStorage = ThrottlerStorage & {
      redis: {
        keys: (pattern: string) => Promise<string[]>;
        del: (...keys: string[]) => Promise<number>;
      };
      onModuleDestroy: () => void;
    };
    let storage: RedisBackedStorage;
    let interceptor: LlmQuotaRefundInterceptor;
    let key: string;

    const hit = () => storage.increment(key, TTL_MS, LIMIT, TTL_MS, 'llm');

    beforeEach(() => {
      storage = createThrottlerStorage(REDIS_URL) as RedisBackedStorage;
      interceptor = new LlmQuotaRefundInterceptor(storage);
      key = `refund-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    });

    afterEach(async () => {
      const keys = await storage.redis.keys(`*${key}*`);
      if (keys.length > 0) await storage.redis.del(...keys);
      storage.onModuleDestroy();
    });

    it('saglayici hatasi harcanan hakki GERI VERIR', async () => {
      await hit(); // 1. cagri: kota dusuldu

      await runAndCatch(
        interceptor,
        contextWithKey(key),
        new LlmProviderError(),
      );

      // Iade calistiysa sonraki cagri yine "1." haktir.
      const next = await hit();
      expect(next.totalHits).toBe(1);
    });

    it('timeout da iade edilir (kullanici yine hicbir sey almadi)', async () => {
      await hit();
      await runAndCatch(
        interceptor,
        contextWithKey(key),
        new LlmTimeoutError(),
      );
      await expect(hit()).resolves.toMatchObject({ totalHits: 1 });
    });

    it('SEMA hatasi iade EDILMEZ — girdiyle tetiklenebilir, ucretsiz cagri kapisi olurdu', async () => {
      await hit();
      await runAndCatch(interceptor, contextWithKey(key), new LlmSchemaError());
      await expect(hit()).resolves.toMatchObject({ totalHits: 2 });
    });

    it('kullanici girdisi hatasi (422) iade EDILMEZ', async () => {
      await hit();
      await runAndCatch(
        interceptor,
        contextWithKey(key),
        new HttpException(
          { message: 'gecersiz ilan' },
          HttpStatus.UNPROCESSABLE_ENTITY,
        ),
      );
      await expect(hit()).resolves.toMatchObject({ totalHits: 2 });
    });

    it('sayac anahtari yoksa (kotasiz uc) hicbir sey yapilmaz', async () => {
      await hit();
      await runAndCatch(interceptor, contextWithKey(), new LlmProviderError());
      await expect(hit()).resolves.toMatchObject({ totalHits: 2 });
    });

    // Anahtar bicimi kutuphanenin ic detayidir; iade onunla AYNI olmak
    // zorunda. Bu test bicim degisirse kirilir - kasitli bekci.
    it('guard ile iade AYNI anahtari kullanir (uctan uca)', async () => {
      const guard = new LlmRateLimitGuard(
        [{ name: 'llm', ttl: TTL_MS, limit: LIMIT }],
        storage,
        new Reflector(),
      );
      await guard.onModuleInit();

      const req: Record<string | symbol, unknown> = {
        user: { id: `u-${key}` },
        ip: '203.0.113.7',
        headers: {},
        method: 'POST',
        path: '/api/interviews',
      };
      const res = {
        header: jest.fn(),
        setHeader: jest.fn(),
        headersSent: false,
      };
      const ctx = {
        switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
        getHandler: () => function endpoint() {},
        getClass: () => class Ctrl {},
        getType: () => 'http',
      } as unknown as ExecutionContext;

      // Kotayi guard uzerinden SONUNA KADAR (ama asmadan) kullan: 3 hakkin
      // ucu de harcandi, dorduncu istek normalde 429 alirdi.
      await guard.canActivate(ctx);
      await guard.canActivate(ctx);
      await guard.canActivate(ctx);

      // Guard anahtari istege birakmis olmali; iade onu bulup dusurmeli.
      expect(req[LLM_QUOTA_KEY]).toEqual(expect.any(String));
      key = req[LLM_QUOTA_KEY] as string; // afterEach temizligi icin

      // UCUNCU cagri saglayici hatasiyla dondu -> hak geri verilir.
      await runAndCatch(interceptor, ctx, new LlmProviderError());

      // Kullanici artik tekrar deneyebilir; iade olmasaydi burasi 429 olurdu.
      await expect(guard.canActivate(ctx)).resolves.toBe(true);

      // Ama iade BIR hak verir, sinirsiz degil: bir sonraki istek yine asar.
      await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException);
    });
  },
);
