-- AlterTable
-- Katmanli soru plani (question-blueprint.ts): her sorunun hangi konu basligina,
-- o konunun kacinci katmanina ve hangi tarza ait oldugu artik kayitla saklanir.
--
-- Uc kolon da NULLABLE: bu alanlar plan ozelligi ONCESI uretilmis sorularda YOK
-- ve uydurulacak bir varsayilanlari da yok (eski sorularin konusu geriye donuk
-- turetilemez). NOT NULL + DEFAULT verilseydi eski kayitlar sahte bir konuya/
-- katmana ait gorunur ve rapor onlari gercek plan verisi sanirdi.
ALTER TABLE "Question" ADD COLUMN     "topic" TEXT;
ALTER TABLE "Question" ADD COLUMN     "layer" INTEGER;
ALTER TABLE "Question" ADD COLUMN     "style" TEXT;
