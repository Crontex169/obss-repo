-- C3: saglayici prompt cache olcumu. inputTokens'in onbellekten karsilanan
-- kismi (ALT KUME). Mevcut satirlar icin 0 = "olculmedi", maliyetleri
-- degismez; yeni kayitlar indirimli fiyatlandirilabilir.
-- AlterTable
ALTER TABLE "TokenUsage" ADD COLUMN     "cachedInputTokens" INTEGER NOT NULL DEFAULT 0;
