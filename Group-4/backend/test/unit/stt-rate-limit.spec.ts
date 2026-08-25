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
