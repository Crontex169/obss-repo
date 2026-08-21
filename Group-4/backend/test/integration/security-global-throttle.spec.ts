import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

// docs/SECURITY.md S3 — LLM disi uc noktalarin hicbirinde siklik siniri yoktu.
// app.module.ts'teki `default` kovasi + APP_GUARD ThrottlerGuard bunu kapatir.
//
// AYRI DOSYADA: test kovayi bilerek tuketir. Ayni dosyadaki diger testler ayni
// ThrottlerStorage'i paylasirdi ve limit onlarin uzerine tasardi; her spec
// dosyasi kendi Nest uygulamasini (dolayisiyla kendi depolamasini) kurdugu icin
// izolasyon dosya sinirindadir.
//
// BU YUZDEN ENTEGRASYON TESTLERI `REDIS_URL` OLMADAN KOSAR (S1). Redis'li
// depoda sayac TUM spec dosyalari arasinda ortaktir — uretimde istenen tam da
// budur, ama burada bu testin tukettigi 300 istek sonraki dosyalara tasar ve
// onlar 429 alir. Redis yolunun kendi kaniti ayri: iki AYRI depo ornegi ayni
// sayaci goruyor mu (test/unit/throttler-storage-redis.spec.ts).
describe('S3 — global siklik siniri (docs/SECURITY.md)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // app.module.ts `default` kovasi: 300 istek / 60 sn.
  const LIMIT = 300;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('LLM disi uc nokta sinirsiz degildir: limit asilinca 429 doner', async () => {
    // Oturumsuz istek: SessionGuard 401 verir, ama global guard ONCE calisir —
    // olculen sey kimlik dogrulama degil, siklik sinirinin varliktir.
    const server = app.getHttpServer();
    const statuses: number[] = [];

    for (let i = 0; i < LIMIT + 5; i += 1) {
      const res = await request(server).get('/api/interviews');
      statuses.push(res.status);
      if (res.status === 429) break;
    }

    // 429 gorulmeli...
    expect(statuses).toContain(429);

    // ...ama kova kullanilabilir genislikte olmali: erken kesen bir sinir
    // normal kullanimi bozar. Ilk 200 istekte 429 CIKMAMALIDIR.
    expect(statuses.slice(0, 200)).not.toContain(429);
  });

  it('prisma baglantisi testin sonunda hala kullanilabilir', async () => {
    // Siklik siniri istegi reddederken baglantiyi bozmamalidir.
    await expect(prisma.user.count()).resolves.toBeGreaterThanOrEqual(0);
  });
});
