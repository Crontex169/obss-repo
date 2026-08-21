import { TtlCache } from '../../src/common/ttl-cache';
import { fetchLinkedInJob } from '../../src/interview/linkedin-job';
import { PdfExtractionService } from '../../src/pdf/pdf-extraction.service';
import type { ConfigService } from '@nestjs/config';

jest.mock('unpdf', () => require('../fakes/fake-unpdf'));
import * as unpdf from 'unpdf';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// C4/C5 — pahali girdi isleri tekrar edilmez.
describe('TtlCache', () => {
  it('sure dolmadan ayni anahtar ayni degeri doner', () => {
    const cache = new TtlCache<string>(1000, 10);
    cache.set('a', 'deger');
    expect(cache.get('a')).toBe('deger');
    expect(cache.get('b')).toBeUndefined();
  });

  it('sure dolunca kayit duser', async () => {
    const cache = new TtlCache<string>(20, 10);
    cache.set('a', 'deger');
    await sleep(40);
    expect(cache.get('a')).toBeUndefined();
  });

  it('tavan asilinca EN ESKI kayit atilir', () => {
    const cache = new TtlCache<number>(1000, 2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });

  it('tazelenen kayit sira SONUNA gider, ilk kurban olmaz', () => {
    const cache = new TtlCache<number>(1000, 2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('a', 9); // tazelendi
    cache.set('c', 3); // tavan asildi -> en eski artik 'b'
    expect(cache.get('a')).toBe(9);
    expect(cache.get('b')).toBeUndefined();
  });

  it('ttl 0 => onbellek tamamen kapali', () => {
    const cache = new TtlCache<string>(0, 10);
    cache.set('a', 'deger');
    expect(cache.get('a')).toBeUndefined();
  });
});

describe('LinkedIn ilan onbellegi', () => {
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;

  const markup =
    '<div class="show-more-less-html__markup"><p>' +
    'Deneyimli Backend Muhendisi ariyoruz, en az uc yil Node.js deneyimi sarttir.' +
    '</p></div>';

  const ok = (body: string) =>
    ({ ok: true, status: 200, text: () => Promise.resolve(body) }) as Response;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterAll(() => {
    global.fetch = realFetch;
  });

  // Onbellek surec omrunce yasar; testler birbirini kirletmesin diye her biri
  // KENDI ilan ID'siyle calisir.
  const urlFor = (id: string) =>
    `https://www.linkedin.com/jobs/view/backend-at-acme-${id}`;

  it('ayni ilan ikinci kez cekilmez', async () => {
    fetchMock.mockResolvedValue(ok(markup));

    const first = await fetchLinkedInJob(urlFor('1000000001'));
    const second = await fetchLinkedInJob(urlFor('1000000001'));

    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('farkli slug ayni ID => yine tek istek (anahtar ID, URL degil)', async () => {
    fetchMock.mockResolvedValue(ok(markup));

    await fetchLinkedInJob(urlFor('1000000002'));
    await fetchLinkedInJob(
      'https://www.linkedin.com/jobs/view/tamamen-baska-baslik-1000000002',
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('basarisiz cekim onbeklege GIRMEZ — sonraki deneme yeniden dener', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve(''),
    });
    await expect(fetchLinkedInJob(urlFor('1000000003'))).rejects.toThrow();

    fetchMock.mockResolvedValue(ok(markup));
    await expect(fetchLinkedInJob(urlFor('1000000003'))).resolves.toContain(
      'Deneyimli Backend Muhendisi',
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('PDF metin cikarma onbellegi', () => {
  const config = { get: (_k: string, d: number) => d } as ConfigService;
  const service = new PdfExtractionService(config);
  const pdf = (body: string) => Buffer.from(`%PDF-1.4\n${body}`, 'utf-8');

  it('ayni baytlar ikinci kez ayristirilmaz', async () => {
    const spy = jest.spyOn(unpdf, 'extractText');
    const buffer = pdf('Deneyimli Yazilim Muhendisi Ariyoruz');

    const first = await service.extractText(buffer, 'application/pdf');
    const before = spy.mock.calls.length;
    // Ayni icerik, YENI bir Buffer nesnesi: anahtar referans degil icerik.
    const second = await service.extractText(
      Buffer.from(buffer),
      'application/pdf',
    );

    expect(second).toBe(first);
    expect(spy.mock.calls.length).toBe(before);
  });

  it('farkli icerik farkli sonuc dondurur', async () => {
    const a = await service.extractText(pdf('Ilan A metni'), 'application/pdf');
    const b = await service.extractText(pdf('Ilan B metni'), 'application/pdf');
    expect(a).not.toBe(b);
  });

  it('gecersiz dosya onbellekten gecerli metin ALMAZ', async () => {
    const buffer = pdf('Deneyimli Yazilim Muhendisi Ariyoruz');
    await service.extractText(buffer, 'application/pdf'); // onbellege girdi
    // Ayni baytlar, ama beyan edilen tur yanlis -> yine de reddedilmeli.
    await expect(service.extractText(buffer, 'text/plain')).rejects.toThrow();
  });
});
