import { describe, expect, it } from 'vitest'

// Eksik bir ceviri anahtari SESSIZ bozulur: i18next fallback'e (tr) duser, EN
// arayuzde Turkce metin cikar; kimse fark etmez. Bu test iki dilin anahtar
// kumesini esitler. Aynisi interpolasyon degiskenleri icin de gecerli —
// EN'de {{minutes}} unutulursa cumle sayisiz render edilir.
const modules = import.meta.glob<Record<string, unknown>>(
  '../src/lib/i18n/locales/*/*.json',
  { eager: true, import: 'default' },
)

/** Ic ice nesneyi "a.b.c" yollarina duzler; diziler indeksle acilir. */
function flatten(value: unknown, prefix = ''): Record<string, string> {
  if (typeof value !== 'object' || value === null) {
    return { [prefix]: String(value) }
  }
  return Object.entries(value).reduce<Record<string, string>>((acc, [key, child]) => {
    return Object.assign(acc, flatten(child, prefix ? `${prefix}.${key}` : key))
  }, {})
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort()
}

/** namespace -> { tr: duzlenmis, en: duzlenmis } */
const byNamespace = new Map<string, Record<string, Record<string, string>>>()
for (const [path, content] of Object.entries(modules)) {
  const [, language, file] = /locales\/([^/]+)\/([^/]+)\.json$/.exec(path) ?? []
  if (!language || !file) continue
  const entry = byNamespace.get(file) ?? {}
  entry[language] = flatten(content)
  byNamespace.set(file, entry)
}

describe('i18n TR/EN paritesi', () => {
  it('locale dosyalari bulunur', () => {
    expect(byNamespace.size).toBeGreaterThan(0)
  })

  for (const [namespace, languages] of byNamespace) {
    it(`${namespace}: anahtar kumeleri ayni`, () => {
      const tr = Object.keys(languages.tr ?? {}).sort()
      const en = Object.keys(languages.en ?? {}).sort()
      expect({ namespace, keys: en }).toEqual({ namespace, keys: tr })
    })

    it(`${namespace}: interpolasyon degiskenleri ayni`, () => {
      const tr = languages.tr ?? {}
      const en = languages.en ?? {}
      const mismatched = Object.keys(tr)
        .filter((key) => key in en)
        .filter((key) => placeholders(tr[key]).join(',') !== placeholders(en[key]).join(','))
      expect(mismatched).toEqual([])
    })
  }
})
