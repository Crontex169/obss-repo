import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { HttpExceptionFilter } from '../../src/common/http-exception.filter';

// T017 — docs/API_CONVENTIONS.md 2: ortak hata zarfi
// { statusCode, error, message, details? } — ic hata metni SIZMAZ.
describe('HttpExceptionFilter', () => {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: '/api/interviews' }),
    }),
  } as unknown as ArgumentsHost;

  const filter = new HttpExceptionFilter();

  beforeEach(() => {
    json.mockClear();
    status.mockClear();
  });

  function body(): Record<string, unknown> {
    return json.mock.calls[0][0] as Record<string, unknown>;
  }

  it('makine-okunur PascalCase error adi uretir', () => {
    filter.catch(new NotFoundException(), host);
    expect(status).toHaveBeenCalledWith(404);
    expect(body()).toMatchObject({ statusCode: 404, error: 'NotFound' });
  });

  it('429 icin TooManyRequests + details.retryAfterSeconds korunur', () => {
    filter.catch(
      new HttpException(
        {
          message: 'Saatlik LLM sinirina ulastiniz.',
          details: { retryAfterSeconds: 1840 },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      ),
      host,
    );
    expect(body()).toEqual({
      statusCode: 429,
      error: 'TooManyRequests',
      message: 'Saatlik LLM sinirina ulastiniz.',
      details: { retryAfterSeconds: 1840 },
    });
  });

  it('dogrulama hatasi mesajini korur (400)', () => {
    filter.catch(new BadRequestException('questionCount 5-20 olmali'), host);
    expect(body()).toMatchObject({
      statusCode: 400,
      error: 'BadRequest',
      message: 'questionCount 5-20 olmali',
    });
  });

  it('bilinmeyen hatada ic detay SIZMAZ', () => {
    const leak = new Error(
      'connect ECONNREFUSED 10.0.0.5:5432 at PrismaClient.query (/app/src/db.ts:42)',
    );
    filter.catch(leak, host);
    expect(status).toHaveBeenCalledWith(500);
    const b = body();
    expect(b).toEqual({
      statusCode: 500,
      error: 'InternalServerError',
      message: expect.any(String),
    });
    expect(JSON.stringify(b)).not.toContain('ECONNREFUSED');
    expect(JSON.stringify(b)).not.toContain('src/db.ts');
    expect(b).not.toHaveProperty('stack');
  });

  it('details yalnizca yapilandirilmis veri tasir — stack asla eklenmez', () => {
    const err = new HttpException(
      { message: 'Saglayici hatasi', details: { provider: 'groq' } },
      HttpStatus.BAD_GATEWAY,
    );
    filter.catch(err, host);
    expect(body()).toMatchObject({ statusCode: 502, error: 'BadGateway' });
    expect(body()).not.toHaveProperty('stack');
  });
});
