const path = require('path');
const dotenv = require('dotenv');
const { execSync } = require('child_process');

// T087(c): integration testleri artik gelistirme (public) semasina degil,
// ayni Postgres ornegindeki izole "test_e2e" semasina yazar. Ayri konteyner/DB
// yerine en az mudahaleli cozum: Prisma'nin DATABASE_URL ?schema= parametresi.
// globalSetup ana process'te calisir, process.env degisikligi Jest worker'larina
// (fork edilirken) miras kalir.
module.exports = async function globalSetup() {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });

  // C2: /api/admin/stats onbellegi entegrasyon testlerinde KAPALI. Testler
  // ayni process icinde once veri yazip hemen istatistik okur; 30 sn'lik
  // taze-olmayan yanit orada gercek bir hata degil, olcum aracinin kendisi olurdu.
  process.env.ADMIN_STATS_CACHE_TTL_MS = '0';

  // C4: LinkedIn ilan onbellegi de entegrasyon testlerinde KAPALI. us1-create-url
  // testleri AYNI ilan ID'sini farkli taklit yanitlarla (200 / 404 / bozuk HTML)
  // arka arkaya kullanir; onbellek acikken ikinci senaryo hic fetch yapmaz ve
  // test kendi kurdugu durumu degil oncekinin kalintisini olcerdi.
  process.env.LINKEDIN_JOB_CACHE_TTL_MS = '0';

  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('schema', 'test_e2e');
  process.env.DATABASE_URL = url.toString();

  // ponytail: her calistirmada db push (migration history yok); yavaslarsa
  // once-hazirlanmis test semasina veya globalTeardown ile drop'a gecilebilir.
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: process.env,
  });

  // 003-pre-assessment: `db push` yalnizca schema.prisma DSL'ini senkronlar -
  // partial unique index (FR-004) DSL'de ifade edilemedigi icin buradan
  // GECMEZ. Elle, idempotent olarak ayrica uygulanir (bkz. manual-constraints.sql).
  execSync(
    'npx prisma db execute --file prisma/manual-constraints.sql --schema prisma/schema.prisma',
    {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      env: process.env,
    },
  );
};
