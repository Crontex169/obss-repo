# Custom Agent Tasarımı

Bu klasör, Mock Interview projesinde kullanılacak **custom agent** rollerini içerir.
Her agent, `.github/agents/<isim>.md` dosyasında tanımlanır: YAML frontmatter (`name`,
`description`) + rolü anlatan gövde.

> Not: Agent içerikleri şimdilik **sade** tutulmuştur. Proje ilerledikçe kararlar
> netleştikçe (stack, contract, güvenlik kuralları) kademeli olarak detaylandırılacaktır.

## Temel Agent'lar

| Agent | Rol | Ana Çıktı |
|---|---|---|
| `analyst` | Gereksinim analizi | Mini-spec + Gherkin kabul kriterleri |
| `architect` | Mimari / sözleşme tasarımı | Veri modeli, API contract, LLM sözleşmesi |
| `test-designer` | Test tasarımı (ATDD/TDD) | Test senaryoları + kırmızı testler |
| `developer` | Uygulama geliştirme | Testleri geçen üretim kodu |
| `reviewer` | Kod incelemesi | Önceliklendirilmiş inceleme yorumları |

## Akış (Mikro-döngü)

```
analyst → architect → test-designer → developer → reviewer
(spec/AC) → (contract) → (test) → (kod) → (review)
```

Bu zincir, `spec/AC → test yaz → kod → self-review → commit → PR` mikro-döngüsüyle uyumludur.

## Genişletilebilirlik

Temel agent'lar, ihtiyaç doğdukça uzman alt agent'lara bölünebilir. Örnek:

- `developer` → `frontend-developer`, `backend-developer`
- İleride: `qa`, `devops`, `security-reviewer` gibi ek roller eklenebilir.

Yeni bir agent eklerken bu klasördeki mevcut dosyaları şablon olarak kullanın.
