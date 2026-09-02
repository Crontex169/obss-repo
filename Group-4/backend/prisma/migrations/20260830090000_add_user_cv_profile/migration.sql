-- Kalici CV profili (User): cikarilmis CV metni + kaynak dosya adi + guncelleme damgasi.
-- Hepsi nullable — mevcut satirlar icin CV yok anlamina gelir, geri dolduruma gerek yoktur.
ALTER TABLE "user" ADD COLUMN "cvText" TEXT;
ALTER TABLE "user" ADD COLUMN "cvFileName" TEXT;
ALTER TABLE "user" ADD COLUMN "cvUpdatedAt" TIMESTAMP(3);
