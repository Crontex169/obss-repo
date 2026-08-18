import { describe, it, expect } from 'vitest'
import {
  normalizeForSpeech,
  applyLexicon,
  PRONUNCIATION_LEXICON,
} from '@/lib/speech/pronunciation'

// FR-035 — Hikaye 1 kabul kriterleri.
// Saf fonksiyon: tarayici API'si gerekmez, davranis dogrudan dogrulanir.

describe('applyLexicon (sozluk eslesmesi)', () => {
  it('Turkce seslendirmede C# fonetik karsiligiyla okunur (kriter 1)', () => {
    expect(applyLexicon('C# deneyiminiz nedir?', 'tr')).toBe(
      'si şarp deneyiminiz nedir?',
    )
  })

  it('Ingilizce seslendirmede C# "C sharp" olur (kriter 3)', () => {
    expect(applyLexicon('What is your C# experience?', 'en')).toBe(
      'What is your C sharp experience?',
    )
  })

  it('uzun terim kisa terimden ONCE eslesir (C++ -> "C"ye dusmez)', () => {
    expect(applyLexicon('C++ ve C# bilginiz', 'tr')).toBe(
      'si plas plas ve si şarp bilginiz',
    )
  })

  it('ASP.NET, .NET kuralina dusmez', () => {
    expect(applyLexicon('ASP.NET projesi', 'tr')).toBe('ey es pi dot net projesi')
    expect(applyLexicon('.NET projesi', 'tr')).toBe('dot net projesi')
  })

  it('MySQL, SQL kuralina dusmez', () => {
    expect(applyLexicon('MySQL ve SQL', 'tr')).toBe('may es ki el ve es ki el')
  })

  it('buyuk/kucuk harf duyarsiz eslesir', () => {
    expect(applyLexicon('api tasarimi', 'tr')).toBe('ey pi ay tasarimi')
    expect(applyLexicon('Api tasarimi', 'tr')).toBe('ey pi ay tasarimi')
  })

  it('Turkce ek apostrofla geldiginde terim yine eslesir, ek korunur', () => {
    expect(applyLexicon("React'i nerede kullandiniz?", 'tr')).toBe(
      "riakt'i nerede kullandiniz?",
    )
  })

  it('kelime icinde gecen terim eslesMEZ (sinir korumasi)', () => {
    // "APIsel" diye bir kelime yok ama sinir kurali kelime icini korumali.
    expect(applyLexicon('KAPIYI actim', 'tr')).toBe('KAPIYI actim')
  })

  it('en degeri null olan terim Ingilizce seslendirmede DEGISMEZ', () => {
    // Ingilizce ses "React"i zaten dogru okur; fonetige cevirmek bozar.
    expect(applyLexicon('React experience', 'en')).toBe('React experience')
  })

  it('sozlukte olmayan terim hata uretmez, aynen kalir (kriter 6)', () => {
    expect(applyLexicon('Zorlu bir Blazor projesi', 'tr')).toBe(
      'Zorlu bir Blazor projesi',
    )
  })

  it('sozlukteki her terimin en az bir dil icin karsiligi vardir', () => {
    for (const entry of PRONUNCIATION_LEXICON) {
      expect(entry.tr ?? entry.en, `bos giris: ${entry.term}`).toBeTruthy()
    }
  })

  it('sozlukte ayni terim iki kez tanimlanmaz', () => {
    const terms = PRONUNCIATION_LEXICON.map((e) => e.term.toLowerCase())
    expect(new Set(terms).size).toBe(terms.length)
  })
})

describe('normalizeForSpeech (genel kurallar)', () => {
  it('Turkce yuzde isareti dogru sirayla okunur', () => {
    expect(normalizeForSpeech('%80 basari orani', 'tr')).toBe(
      'yüzde 80 basari orani',
    )
  })

  it('Ingilizce yuzde her iki yazimda da dogru okunur', () => {
    expect(normalizeForSpeech('80% success', 'en')).toBe('80 percent success')
    expect(normalizeForSpeech('%80 success', 'en')).toBe('80 percent success')
  })

  it('sayi araligi "ila" ile okunur', () => {
    expect(normalizeForSpeech('3-5 yil deneyim', 'tr')).toBe('3 ila 5 yil deneyim')
    expect(normalizeForSpeech('3-5 years', 'en')).toBe('3 to 5 years')
  })

  it('tarih benzeri uzun sayi dizisi aralik sanilMAZ', () => {
    expect(normalizeForSpeech('2026-08-05 tarihinde', 'tr')).toBe(
      '2026-08-05 tarihinde',
    )
  })

  it('arti isareti kelimeye cevrilir', () => {
    expect(normalizeForSpeech('5+ yil deneyim', 'tr')).toBe('5 artı yil deneyim')
  })

  it('ve isareti dile gore okunur', () => {
    expect(normalizeForSpeech('Ar-Ge & uretim', 'tr')).toBe('arge ve uretim')
    expect(normalizeForSpeech('research & development', 'en')).toBe(
      'research and development',
    )
  })

  it('kelimeler arasi bolu isareti duraklamaya cevrilir, "bolu" diye okunmaz', () => {
    expect(normalizeForSpeech('planlama/raporlama gorevleri', 'tr')).toBe(
      'planlama, raporlama gorevleri',
    )
  })

  it('sozluk genel kurallardan ONCE calisir (CI/CD bolu kuralina dusmez)', () => {
    expect(normalizeForSpeech('CI/CD sureci', 'tr')).toBe('si ay si di sureci')
  })

  it('coklu bosluk sadelestirilir ve bas/son bosluk kirpilir', () => {
    expect(normalizeForSpeech('  iki   bosluk  ', 'tr')).toBe('iki bosluk')
  })

  it('meslek-bagimsiz kisaltmalar da kapsanir (FR-029)', () => {
    expect(normalizeForSpeech('ISO 9001 belgesi', 'tr')).toBe('izo 9001 belgesi')
    expect(normalizeForSpeech('CNC tezgahi', 'tr')).toBe('si en si tezgahi')
    expect(normalizeForSpeech('120 m² alan', 'tr')).toBe('120 metrekare alan')
  })
})
