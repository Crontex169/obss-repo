-- Prisma DSL'in ifade edemedigi kisitlar (partial/kosullu index'ler).
-- `db push` (test/global-setup.js -> test_e2e semasi) bu SQL'i UYGULAMAZ -
-- yalnizca schema.prisma DSL'ini senkronlar. Gercek migration (public semasi)
-- icin ayni satir backend/prisma/migrations/<ts>_pre_assessment/migration.sql
-- icinde de mevcuttur; bu dosya YALNIZCA test_e2e semasi icin `db push`
-- sonrasinda elle calistirilir (bkz. global-setup.js).
CREATE UNIQUE INDEX IF NOT EXISTS "pre_assessment_one_active_per_user"
  ON "PreAssessment" ("userId")
  WHERE "isActive" = true;
