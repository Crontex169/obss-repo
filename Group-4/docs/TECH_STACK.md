# TECH_STACK.md

> Kararlaştırılan teknolojiler bu dosyada kilitlenir. Gerekçeler için bkz. `DECISIONS.md`.
> `_TBD_` işaretli kategoriler henüz kararlaştırılmadı.

## Frontend

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | React | 19.x |
| Build tool | Vite | 8.x |
| Language | TypeScript | 6.x |
| Styling | Tailwind CSS | 4.x |
| UI components | shadcn/ui | latest |
| PDF üretimi (istemci) | **jsPDF** — tek başına, `html2canvas` YOK | ^4.2.1 |
| Toast bildirimi | sonner | ^2.0.7 |
| Uygulama dili (i18n) | **i18next + react-i18next** — TR/EN, sözlükler `src/lib/i18n/locales/` | ^26.3.6 / ^17.0.11 |
| Tema (açık/koyu) | **Kendi ince katmanı** — kütüphane yok; `<html data-theme>` + `localStorage`, `src/lib/theme/` | — |

> **Tema (dark mode):** `light`/`dark` iki seçenek (bilinçli olarak "sistemi takip et" yok).
> Tercih `localStorage`'da tutulur, backend'e gitmez; i18n dil seçimiyle **aynı deseni**
> paylaşır (`src/lib/theme/theme-provider.tsx`, Ayarlar sayfasından değiştirilir). Ek bir
> UI kütüphanesi getirmez — `index.css`'teki `:root[data-theme="dark"]` bloğunu tetikler.
>
> jsPDF, sonner, i18next ve tema katmanı için ayrı ADR açılmadı: hepsi kilitli yığını
> (ADR-0001…0012) etkilemeyen, düşük riskli seçimlerdir. i18n henüz spec'lenmemiştir — dil değiştirme
> akışının gereksinimleri (arşiv raporların dili, `Accept-Language` ile ilişkisi) hâlâ
> yazılı değildir. jsPDF gerekçesi
> `specs/004-history/research-pdf-karar.md`'de kayıtlıdır. Rapor PDF'i skor
> görsellerini ve radar grafiğini **jsPDF vektör primitifleriyle** çizer —
> ekran görüntüsü alınmaz, bu yüzden `html2canvas` bağımlılığı yoktur.

> Not (T083, bulgu G2): frontend TS 6.x, backend TS 5.7.x — iki ayrı `package.json`,
> iki ayrı derleme hedefi (Vite/tsc vs NestJS/tsc); aynı majör zorunlu değil, sürümler
> kasıtlı olarak bağımsız tutulur.

## Backend

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | NestJS (Node.js) | 11.x |
| Language | TypeScript | 5.7.x |
| ORM | Prisma (sürüm kilitli — ADR-0005) | 6.19.3 |
| PDF processing | **unpdf** (ADR-0009) — native derleme bağımlılığı yok, Mozilla PDF.js motoru | ^1.8.0 |
| Girdi doğrulama (DTO) | **Zod** — `class-validator`/`class-transformer` eklenmedi | — |

> Gerekçe: ADR-0002 (framework/veritabanı), ADR-0005 (ORM sürüm kilidi), ADR-0009 (PDF)
> (`DECISIONS.md`). Girdi doğrulama: proje zaten Zod'u env doğrulama ve LLM şemalarında
> zorunlu kullanıyor (ADR-0007); HTTP DTO'ları için ikinci bir doğrulama kütüphanesi
> (`class-validator`) eklemek yalnızca tutarsızlık ve ekstra bağımlılık getirirdi —
> `backend/src/common/zod-validation.pipe.ts` tek satırlık genel bir `PipeTransform`.

## Database

| Category | Technology | Version |
|----------|-----------|---------|
| RDBMS | PostgreSQL | 16.x |
| Geliştirme | Docker (local) | — |
| Production | Managed Postgres (Neon/Supabase/Railway/RDS) | — |

> Gerekçe: ADR-0002 (`DECISIONS.md`).

## Authentication & Authorization

| Category | Technology | Version |
|----------|-----------|---------|
| Auth kütüphanesi | Better Auth (self-hosted, kendi Postgres) | latest |
| Yöntemler | E-posta/şifre + Google OAuth (kullanıcı); admin sadece e-posta/şifre | — |
| Oturum | "Beni hatırla" 30 gün / aksi halde session-scoped | — |
| Yetki | NestJS Guard ile rol tabanlı (kullanıcı/admin) | — |
| Mail (e-posta doğrulama) | **Resend** (`resend` npm SDK) — `MAIL_TRANSPORT=console` geliştirmede, `resend` üretimde | latest |

> Gerekçe: ADR-0003 (auth kütüphanesi), **ADR-0008** (mail gönderim yolu) (`DECISIONS.md`).

## AI / LLM

| Category | Technology | Version |
|----------|-----------|---------|
| LLM provider (birincil) | **Groq** — ücretsiz katman | — |
| LLM provider (yedek) | **DeepSeek** — kota dolarsa | — |
| İstemci SDK | `openai` npm (her ikisi de OpenAI-uyumlu API) | latest |
| Model adayları | `openai/gpt-oss-20b` · `openai/gpt-oss-120b` — **Groq'ta `strict: true` yalnızca bu ikisinde** | — |
| **Seçilen model** | **`openai/gpt-oss-120b`** (T001 — Türkçe kalitesi manuel doğrulandı) | — |
| İkincil aday | `openai/gpt-oss-20b` — kota/gecikme sorun olursa `.env`'de tek satır | — |
| `strict` şema kısıtı | Tüm alanlar `required`; opsiyonellik `.nullable()` ile (`.optional()` **kullanılmaz**); `additionalProperties: false` | — |
| Yapılandırılmış çıktı | Groq: `json_schema` + `strict` · DeepSeek: `json_object` + prompt'a gömülü şema | — |
| Runtime şema doğrulama | Zod (her sağlayıcıda zorunlu — DeepSeek yolunda tek garanti) | — |
| LLM çağrı timeout | `LLM_REQUEST_TIMEOUT_MS` varsayılan **30 sn**; çağrı başına override (interview raporu **60 sn**) | — |
| Voice / Speech (STT-TTS) | **Tarayıcı Web Speech API** — istemci tarafı, sunucuda ses işleme yok (ADR-0010) | tarayıcı yerleşik |

> Gerekçe: ADR-0007 (`DECISIONS.md`). Eleyici eksen **maliyet**: LLM maliyeti sıfır olmalı.
> ADR-0006 (OpenAI) bu kısıt nedeniyle değiştirildi ve tarihsel kayıt olarak korunuyor.
>
> **Açık riskler:** (1) ~~Türkçe üretim kalitesi doğrulanmadı~~ → **kapandı (2026-07-31)**:
> `openai/gpt-oss-120b` Groq Console'da manuel doğrulandı (T001). Otomatik ölçüm (süre/token/
> tekrarlı şema uyumu) yapılmadı — `spike/model-spike.mjs` gerektiğinde koşulabilir. (2) ~~`strict` modu hangi modellerde~~ →
> **cevaplandı (2026-07-31):** yalnızca `openai/gpt-oss-20b` ve `openai/gpt-oss-120b`;
> şema kısıtları `docs/API_CONVENTIONS.md` §3.3'e işlendi (R5). (3) ~~Sözlü mod çözümsüz~~ → **ADR-0010 ile kapandı**:
> tarayıcı Web Speech API, maliyet sıfır, sunucu sözleşmesi değişmiyor. Bedeli: tarayıcı
> bağımlılığı (Chrome/Edge); desteklenmeyen tarayıcıda sözlü mod UI'da devre dışı gösterilir.

## Data Visualization

| Category | Technology | Version |
|----------|-----------|---------|
| Grafik kütüphanesi | **Recharts** — shadcn/ui `Chart` bileşenleri üzerinden | v3 hattı |
| Kurulum | `npx shadcn add chart` (sürüm elle pinlenmez) | — |
| Kullanılan tipler | `RadarChart` (rapor 3 eksen) · `BarChart` / `PieChart` / `LineChart` (admin) | — |
| Erişilebilirlik | `accessibilityLayer` **açık**; her grafiğin yanında metinsel değer | — |

> Gerekçe: **ADR-0011** (`DECISIONS.md`). Belirleyici eksen: shadcn/ui anayasa ile kilitli
> (ADR-0001) ve chart bileşenleri Recharts üzerine kurulu — başka kütüphane ikinci bir görsel
> dil getirirdi. Radar chart yerleşik olduğu için rapor ekranı ek mühendislik istemiyor.
> İkinci bir görselleştirme kütüphanesi **eklenmez**.

## Storage

| Category | Technology | Version |
|----------|-----------|---------|
| _TBD_ | _Kararlaştırılacak_ | — |

## Testing

| Category | Technology | Version |
|----------|-----------|---------|
| Backend birim/entegrasyon | Jest | latest |
| Backend e2e/HTTP | Supertest | latest |
| Frontend birim/component | Vitest + React Testing Library | latest |
| Uçtan uca (e2e) | Playwright | latest |

> Gerekçe: ADR-0004 (`DECISIONS.md`).

## DevOps / Deployment

| Category | Technology | Version |
|----------|-----------|---------|
| _TBD_ | _Kararlaştırılacak_ | — |

## Development Tools

| Category | Technology | Version |
|----------|-----------|---------|
| _TBD_ | _Kararlaştırılacak_ | — |

## Git Workflow

| Category | Decision |
|----------|----------|
| _TBD_ | _Kararlaştırılacak_ |

## Notes

- Bu doküman ekip kararıyla güncellenir; her satır değişikliği `DECISIONS.md` içinde gerekçelendirilir.
