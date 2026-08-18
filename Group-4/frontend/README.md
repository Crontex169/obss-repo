# frontend — React 19 + Vite SPA

Kurulum ve çalıştırma için kök [`README.md`](../README.md) esastır.

## Ortam değişkenleri

```bash
cp .env.example .env
```

- **`VITE_API_URL`** — dolu ise istemciler backend'e **mutlak URL** ile gider
  (local varsayılan `http://localhost:3000`). Boş bırakılırsa istekler göreli
  `/api/...` yoluna düşer ve `vite.config.ts`'teki proxy devreye girer; bu yol
  Cloudflare tunnel gibi tek-origin gereken senaryolar içindir.
- **`VITE_GOOGLE_CLIENT_ID`** — Google One Tap için; kök `.env`'deki
  `GOOGLE_CLIENT_ID` ile aynı olmalı.

## Bu klasörde ne var

| Yol | İçerik |
|-----|--------|
| `src/pages/` | login/register/verify-email, şifre sıfırlama, dashboard, `interview/*`, `pre-assessment/*`, `admin/*` |
| `src/components/ui/` | shadcn/ui bileşenleri (Recharts tabanlı `Chart` dahil, ADR-0011) |
| `src/components/{auth,interview,pre-assessment,admin}/` | Dikey dilimlere ait bileşenler |
| `src/lib/` | API istemcileri, Zod form doğrulama, Web Speech sarmalayıcısı (ADR-0010), jsPDF rapor üretimi |
| `src/lib/i18n/` | TR/EN çeviri altyapısı (i18next + react-i18next): `index.ts`, `language-provider.tsx`, `locales/{tr,en}/*.json` |
| `src/lib/support.ts` | Destek e-posta adresi — tek doğruluk kaynağı; `support-link.tsx` ve `site-footer.tsx` buradan okur |
| `src/pages/settings.tsx` | Ayarlar sayfası — uygulama dili buradan değiştirilir |
| `src/routes/` | `protected.tsx` (oturum) ve `admin-protected.tsx` (rol) route guard'ları |
| `test/` | Vitest + React Testing Library |
| `test/e2e/` | Playwright — backend ve Postgres **ayrıca** ayakta olmalı |

Dosya-bazlı ayrıntılı harita: [`docs/PROJECT_MAP.md`](../docs/PROJECT_MAP.md) §5.

## Komutlar

```bash
npm run dev        # http://localhost:5173
npm run test       # Vitest
npm run test:e2e   # Playwright (backend + db:seed gerekir)
npm run lint       # oxlint
```
