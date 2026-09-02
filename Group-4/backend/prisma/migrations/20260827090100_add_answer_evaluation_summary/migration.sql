-- AlterTable
-- Adaptif uyarlama her turda zaten bir DAHILI degerlendirme uretiyordu
-- (adaptive.ts evaluationSummary) ama hicbir yerde okunmuyor, kaydedilmiyordu:
-- model her cevap icin bunu yaziyor, sistem cope atiyordu. Artik saklanir ve
-- (a) sonraki uyarlamaya, (b) rapora baglam olarak verilir.
--
-- NULLABLE: uyarlama KAPALI olan gorusmelerde hic uretilmez, uyarlama basarisiz
-- oldugunda da akis bilerek devam eder (FR-011) — yoklugu normal bir durumdur,
-- hata degil.
ALTER TABLE "Answer" ADD COLUMN     "evaluationSummary" TEXT;
