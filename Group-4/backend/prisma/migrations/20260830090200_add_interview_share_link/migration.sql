-- Rapor paylasim linki: tahmin edilemez token + son kullanma tarihi.
-- Token uzerinden ANONIM okuma yapildigi icin benzersiz indeks ZORUNLU
-- (aramanin tek anahtari budur, cakisma paylasilan raporu yanlis kisiye acardi).
ALTER TABLE "Interview" ADD COLUMN "shareToken" TEXT;
ALTER TABLE "Interview" ADD COLUMN "shareExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Interview_shareToken_key" ON "Interview"("shareToken");
