# backend — NestJS API

Kurulum, ortam değişkenleri, çalıştırma ve test komutları için kök
[`README.md`](../README.md) esastır. Kısa özet için
[`SETUP.md`](../SETUP.md).

## Bu klasörde ne var

| Yol | İçerik |
|-----|--------|
| `prisma/` | `schema.prisma`, migration'lar, `seed.ts` (admin hesabı), `manual-constraints.sql` (elle yazılan partial unique index) |
| `src/auth/` | Better Auth köprüsü, guard zinciri (Session → Roles → Ownership), hook'lar, mail |
| `src/users/` | Profil + KVKK onayı uçları |
| `src/interview/` | Görüşme akışı + LLM prompt'ları (soru üretimi, adaptif, rapor) |
| `src/pre-assessment/` | Ön yetkinlik değerlendirmesi |
| `src/admin/` | Admin paneli uçları (salt okunur) |
| `src/llm/` | Sağlayıcıdan bağımsız LLM katmanı, şema doğrulama, token/maliyet kaydı |
| `src/common/` | Hata filtresi, Zod pipe, dil çözümleme, LLM hız sınırı guard'ı |
| `test/unit/`, `test/integration/` | Jest + Supertest |

Dosya-bazlı ayrıntılı harita: [`docs/PROJECT_MAP.md`](../docs/PROJECT_MAP.md) §4.
Dikeyler arası HTTP/veri sözleşmeleri: [`docs/API_CONVENTIONS.md`](../docs/API_CONVENTIONS.md).

## Sık kullanılan komutlar

```bash
npm run start:dev    # http://localhost:3000 (watch)
npm run db:seed      # admin hesabini olusturur (idempotent)
npm run test         # birim testler
npm run test:e2e     # entegrasyon testleri (calisir Postgres gerekir)
npx prisma migrate dev
```

> Prisma sürümü `6.19.3` olarak **exact pin**'lidir (ADR-0005). Yükseltmeyin.
