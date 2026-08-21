import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorageService } from '@nestjs/throttler';
import { LlmRateLimitGuard } from '../../src/common/guards/llm-rate-limit.guard';

// T016 — FR-022 / docs/API_CONVENTIONS.md 3.5
// Kullanici basina saatlik LLM cagri sayaci. Limit UC NOKTADA verilir
// (3/saat soru uretimi, 5/saat rapor retry, 60/saat cevap) — guard'a gomulu degil.
describe('LlmRateLimitGuard', () => {
  const TTL_MS = 3_600_000;
  let storage: ThrottlerStorageService;
  let guard: LlmRateLimitGuard;

  // Sahte yanit `setHeader` de tasir: guard 429'da `Retry-After` yazar
  // (throttle-response.ts). Eksik birakilirsa test gercek davranisi degil
  // sahtenin eksigini olcer.
  function contextFor(userId: string): ExecutionContext {
    const req = {
      user: { id: userId },
      ip: '203.0.113.7',
      headers: {},
      method: 'POST',
      path: '/api/interviews',
    };
    const res = { header: jest.fn(), setHeader: jest.fn(), headersSent: false };
    const handler = function endpoint() {};
    return {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
      getHandler: () => handler,
      getClass: () => class Ctrl {},
      getType: () => 'http',
      // Testin `res`e ulasabilmesi icin (Retry-After dogrulamasi).
      __res: res,
    } as unknown as ExecutionContext;
  }

  beforeEach(async () => {
    storage = new ThrottlerStorageService();
    guard = new LlmRateLimitGuard(
      [{ name: 'llm', ttl: TTL_MS, limit: 3 }],
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
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException);
  });

  it('asimda details.retryAfterSeconds tasiyan ortak zarf doner', async () => {
    const ctx = contextFor('user-b');
    await guard.canActivate(ctx);
    await guard.canActivate(ctx);
    await guard.canActivate(ctx);

    const err: HttpException = await guard.canActivate(ctx).then(
      () => {
        throw new Error('429 bekleniyordu');
      },
      (e: HttpException) => e,
    );

    expect(err.getStatus()).toBe(429);
    const body = err.getResponse() as {
      message: string;
      details: { retryAfterSeconds: number };
    };
    expect(typeof body.message).toBe('string');
    expect(body.details.retryAfterSeconds).toBeGreaterThan(0);
    expect(body.details.retryAfterSeconds).toBeLessThanOrEqual(TTL_MS / 1000);

    // Ayni sure STANDART baslikta da bulunur (RFC 9110 §10.2.3): istemci
    // kutuphaneleri ve vekiller govdeyi degil bunu okur.
    const res = (ctx as unknown as { __res: { setHeader: jest.Mock } }).__res;
    expect(res.setHeader).toHaveBeenCalledWith(
      'Retry-After',
      String(Math.ceil(body.details.retryAfterSeconds)),
    );
  });

  it('sayac basarili + basarisiz cagrilari birlikte sayar', async () => {
    // Guard istek ONCESI calisir; sonucundan haberi olmaz. Yani downstream
    // handler hata dondurse de sayac dusmez — 3 istek = 3 kontenjan.
    const ctx = contextFor('user-c');
    await guard.canActivate(ctx);
    await guard.canActivate(ctx);
    await guard.canActivate(ctx);
    await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException);
  });

  it('farkli kullanicilar birbirinin kontenjanini tuketmez', async () => {
    const a = contextFor('user-d');
    const b = contextFor('user-e');
    await guard.canActivate(a);
    await guard.canActivate(a);
    await guard.canActivate(a);
    await expect(guard.canActivate(a)).rejects.toThrow(HttpException);
    await expect(guard.canActivate(b)).resolves.toBe(true);
  });

  it('oturum yoksa IP ye duser (guard tek basina 401 uretmez)', async () => {
    const anon = {
      switchToHttp: () => ({
        getRequest: () => ({
          ip: '198.51.100.9',
          headers: {},
          method: 'POST',
          path: '/api/interviews',
        }),
        getResponse: () => ({
          header: jest.fn(),
          setHeader: jest.fn(),
          headersSent: false,
        }),
      }),
      getHandler: () => function h() {},
      getClass: () => class C {},
      getType: () => 'http',
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(anon)).resolves.toBe(true);
  });
});
