-- Ilan x CV uyum analizi kendi LLM cagrisidir; token/maliyet kaydi (TokenUsage)
-- operasyon bazinda ayrisir, bu yuzden enum'a yeni bir deger eklenir.
ALTER TYPE "LlmOperation" ADD VALUE 'cv_job_match';
