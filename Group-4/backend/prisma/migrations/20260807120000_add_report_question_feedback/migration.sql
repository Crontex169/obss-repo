-- AlterTable
-- Issue #68 — soru bazli geri bildirim. Mevcut raporlar icin bos dizi:
-- NOT NULL + DEFAULT ile geriye donuk kayitlar da gecerli kalir.
ALTER TABLE "Report" ADD COLUMN     "questionFeedback" JSONB NOT NULL DEFAULT '[]';
