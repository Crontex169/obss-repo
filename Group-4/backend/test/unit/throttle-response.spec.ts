import type { ExecutionContext } from '@nestjs/common';
import {
  logThrottled,
  setRetryAfter,
} from '../../src/common/guards/throttle-response';

// 429 yaniti (2026-08-21) — ortak parcalari.
function fakeContext(overrides: Record<string, unknown> = {}) {
  const headers: Record<string, string> = {};
  const res = {
    headersSent: false,
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
    ...(overrides.res as object),
  };
  const req = {
    method: 'POST',
    path: '/api/interviews/abc-123/answers',
    route: { path: '/api/interviews/:id/answers' },
    ...(overrides.req as object),
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ExecutionContext;
  return { context, headers, res };
}

describe('setRetryAfter', () => {
  it('tam saniyeye YUKARI yuvarlar', () => {
    // Asagi yuvarlansaydi istemci sinir kalkmadan tekrar dener, ikinci 429 alirdi.
    const { context, headers } = fakeContext();
    setRetryAfter(context, 12.1);
    expect(headers['Retry-After']).toBe('13');
  });

  it('sifir/negatif surede en az 1 saniye yazar', () => {
    const { context, headers } = fakeContext();
    setRetryAfter(context, 0);
    expect(headers['Retry-After']).toBe('1');
  });

  it('yanit gonderilmisse baslik eklemez (hata firlatmaz)', () => {
    const { context, headers } = fakeContext({ res: { headersSent: true } });
    expect(() => setRetryAfter(context, 5)).not.toThrow();
    expect(headers['Retry-After']).toBeUndefined();
  });
});

describe('logThrottled', () => {
  // Log satiri bir OLCUM veri setidir (docs/METRICS.md 1.5): bicimi bozulursa
  // toplama sorgusu sessizce bos doner, bu yuzden testle sabitlenir.
  function capture(fn: () => void): string {
    const lines: string[] = [];
    const spy = jest
      .spyOn(
        // Logger ornegi modul icinde; prototip uzerinden yakalanir.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-require-imports
        require('@nestjs/common').Logger.prototype as { warn: unknown },
        'warn' as never,
      )
      .mockImplementation(((line: string) => lines.push(line)) as never);
    fn();
    spy.mockRestore();
    return lines.join('\n');
  }

  it('kova, uc nokta sablonu, limit ve kullanici tek satirda', () => {
    const { context } = fakeContext({ req: { user: { id: 'user-1' } } });
    const line = capture(() => logThrottled(context, 'llm', 60, 3599.4));
    expect(line).toBe(
      '[ratelimit] llm POST /api/interviews/:id/answers limit=60 user=user-1 retryAfter=3600s',
    );
  });

  it('ham URL degil ROUTE SABLONU yazilir (id basina ayri satir olmaz)', () => {
    const { context } = fakeContext();
    const line = capture(() => logThrottled(context, 'llm', 3, 10));
    expect(line).toContain('/api/interviews/:id/answers');
    expect(line).not.toContain('abc-123');
  });

  it('oturumsuz (IP kovasi) istekte ham IP YAZILMAZ', () => {
    const { context } = fakeContext({
      req: { ip: '203.0.113.7', user: undefined },
    });
    const line = capture(() => logThrottled(context, 'default', 300, 42));
    expect(line).toContain('user=yok');
    expect(line).not.toContain('203.0.113.7');
  });
});
