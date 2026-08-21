import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { createThrottlerStorage } from '../../src/common/throttler-storage';

// S1 — hiz siniri sayaclari surec-yerel oldugu surece:
//   1. cok ornekli dagitimda gercek sinir ornek sayisiyla CARPILIR,
//   2. yeniden baslatmada sayaclar sifirlanir.
// Bu testin olctugu sey tam olarak (1)'dir: AYRI iki depo ornegi (= ayri iki
// uygulama ornegi) ayni sayaci gorur mu?
//
// Redis gerektirir. `REDIS_URL` verilmemisse atlanir - gelistirme ve CI ek
// servis kurmadan calisabilsin diye (uygulamanin kendisi de REDIS_URL yoksa
// bellek deposuna duser).
const REDIS_URL = process.env.REDIS_URL;
const describeRedis = REDIS_URL ? describe : describe.skip;

describe('createThrottlerStorage', () => {
  it('REDIS_URL yoksa undefined doner (kutuphane varsayilani = bellek)', () => {
    expect(createThrottlerStorage(undefined)).toBeUndefined();
    expect(createThrottlerStorage('')).toBeUndefined();
  });
});

describeRedis('Redis sayac deposu', () => {
  const TTL_MS = 60_000;
  const LIMIT = 3;
  let a: ThrottlerStorageRedisService;
  let b: ThrottlerStorageRedisService;
  let key: string;

  beforeEach(() => {
    // Iki AYRI ornek: tek surecte iki uygulama kopyasinin taklidi.
    a = createThrottlerStorage(REDIS_URL) as ThrottlerStorageRedisService;
    b = createThrottlerStorage(REDIS_URL) as ThrottlerStorageRedisService;
    key = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  });

  afterEach(async () => {
    // Anahtar adini kutuphane belirler (onek/sonek ekler), bu yuzden desenle
    // temizlenir — testin ic isleyise bagimli tek noktasi burasi degil, hicbir
    // yeri olmasin diye.
    const keys = await a.redis.keys(`*${key}*`);
    if (keys.length > 0) await a.redis.del(...keys);
    a.onModuleDestroy();
    b.onModuleDestroy();
  });

  // blockDuration = ttl: ThrottlerGuard'in kendi varsayilani da budur
  // (`blockDuration || ttl`). 0 vermek gercekci degildir; Redis tarafinda
  // "invalid expire time" hatasi verir.
  const hit = (storage: ThrottlerStorageRedisService) =>
    storage.increment(key, TTL_MS, LIMIT, TTL_MS, 'llm');

  it('bir ornekte artan sayac digerinde de gorunur', async () => {
    const first = await hit(a);
    expect(first.totalHits).toBe(1);

    // Surec-yerel bellekte bu 1 donerdi (her ornegin kendi sayaci) —
    // paylasimli depoda 2 doner.
    const second = await hit(b);
    expect(second.totalHits).toBe(2);
  });

  it('limit iki ornege DAGITILMIS isteklerle dolar', async () => {
    await hit(a);
    await hit(b);
    await hit(a);

    // Dorduncu istek hangi ornege giderse gitsin limiti asar.
    const fourth = await hit(b);
    expect(fourth.totalHits).toBeGreaterThan(LIMIT);
    expect(fourth.isBlocked).toBe(true);
  });

  it('sayac TTL tasir (kalici degil)', async () => {
    const record = await hit(a);
    expect(record.timeToExpire).toBeGreaterThan(0);
    expect(record.timeToExpire).toBeLessThanOrEqual(TTL_MS / 1000);
  });
});
