import {
  Logger,
  type CallHandler,
  type ExecutionContext,
} from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { RequestTimingInterceptor } from '../../src/common/request-timing.interceptor';

// docs/METRICS.md — endpoint sureleri ayristirilabilir tek bir formatta
// loglanir. Testin korudugu sozlesme: (1) ham URL degil ROUTE SABLONU yazilir
// (aksi halde her id ayri satir olur, endpoint bazli p50/p95 cikarilamaz),
// (2) hata yolunda da olcum yapilir, (3) yanit degistirilmez.
describe('RequestTimingInterceptor', () => {
  function makeContext(overrides: {
    route?: { path: string };
    path?: string;
    method?: string;
    statusCode?: number;
  }) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          route: overrides.route,
          path: overrides.path ?? '/fallback',
          method: overrides.method ?? 'GET',
        }),
        getResponse: () => ({ statusCode: overrides.statusCode ?? 200 }),
      }),
    } as unknown as ExecutionContext;
  }

  let debug: jest.SpyInstance;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    debug = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('route sablonunu loglar, ham id yazmaz', async () => {
    const interceptor = new RequestTimingInterceptor();
    const context = makeContext({
      route: { path: '/interviews/:id' },
      path: '/interviews/cm123abc',
      method: 'GET',
    });
    const next: CallHandler = { handle: () => of({ ok: true }) };

    await firstValueFrom(interceptor.intercept(context, next));

    expect(debug).toHaveBeenCalledTimes(1);
    const line = debug.mock.calls[0][0] as string;
    expect(line).toMatch(/^\[timing\] GET \/interviews\/:id 200 \d+ms$/);
    expect(line).not.toContain('cm123abc');
  });

  it('route sablonu yoksa istek yoluna duser', async () => {
    const interceptor = new RequestTimingInterceptor();
    const context = makeContext({ path: '/api/auth/sign-in', method: 'POST' });
    const next: CallHandler = { handle: () => of(null) };

    await firstValueFrom(interceptor.intercept(context, next));

    expect(debug.mock.calls[0][0]).toContain('POST /api/auth/sign-in 200');
  });

  it('hata yolunda da olcer ve hatanin status kodunu yazar', async () => {
    const interceptor = new RequestTimingInterceptor();
    const context = makeContext({
      route: { path: '/interviews' },
      method: 'POST',
    });
    const next: CallHandler = {
      handle: () => throwError(() => ({ status: 429 })),
    };

    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).rejects.toEqual({ status: 429 });
    expect(debug.mock.calls[0][0]).toContain('POST /interviews 429');
  });

  it('status tasimayan hatalar 500 olarak yazilir', async () => {
    const interceptor = new RequestTimingInterceptor();
    const context = makeContext({ route: { path: '/interviews' } });
    const next: CallHandler = {
      handle: () => throwError(() => new Error('patladi')),
    };

    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).rejects.toThrow('patladi');
    expect(debug.mock.calls[0][0]).toContain('500');
  });

  it('yavas istekler warn seviyesine yukselir', async () => {
    const interceptor = new RequestTimingInterceptor();
    const context = makeContext({ route: { path: '/interviews/:id/report' } });
    // Date.now'i ilerleterek esigin (1000 ms) asilmasini taklit ediyoruz —
    // gercek bekleme testi yavaslatmasin.
    const realNow = Date.now;
    let calls = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => {
      calls += 1;
      return calls === 1 ? 0 : 1_500;
    });
    const next: CallHandler = { handle: () => of('ok') };

    await firstValueFrom(interceptor.intercept(context, next));
    Date.now = realNow;

    expect(warn).toHaveBeenCalledTimes(1);
    expect(debug).not.toHaveBeenCalled();
    expect(warn.mock.calls[0][0]).toContain('1500ms');
  });

  it('yaniti degistirmez', async () => {
    const interceptor = new RequestTimingInterceptor();
    const context = makeContext({ route: { path: '/interviews' } });
    const payload = { data: [1, 2, 3] };
    const next: CallHandler = { handle: () => of(payload) };

    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).resolves.toBe(payload);
  });
});
