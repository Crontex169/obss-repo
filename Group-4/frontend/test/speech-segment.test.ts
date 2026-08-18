import { describe, it, expect } from 'vitest'
import {
  segmentForSpeech,
  splitIntoChunks,
  MAX_CHUNK_LENGTH,
  ENGLISH_VOICE_TERMS,
} from '@/lib/speech/segment'

// FR-035 / FR-036 — Hikaye 1, kriter 2 ve 4.

describe('segmentForSpeech (dil gecisi)', () => {
  it('Ingilizce gorusmede tek parca doner — bolmeye gerek yok', () => {
    expect(segmentForSpeech('Describe your deployment process.', 'en')).toEqual([
      { text: 'Describe your deployment process.', lang: 'en' },
    ])
  })

  it('Turkce metindeki cok heceli Ingilizce terim Ingilizce sese devredilir (kriter 2)', () => {
    expect(segmentForSpeech('Bir deployment sureci anlatin.', 'tr')).toEqual([
      { text: 'Bir', lang: 'tr' },
      { text: 'deployment', lang: 'en' },
      { text: 'sureci anlatin.', lang: 'tr' },
    ])
  })

  it('Ingilizce parca fonetige CEVRILMEZ, oldugu gibi aktarilir', () => {
    const segments = segmentForSpeech('framework seciminiz', 'tr')
    expect(segments[0]).toEqual({ text: 'framework', lang: 'en' })
  })

  it('Turkce parcalar normalize edilir, Ingilizce parcalar edilmez', () => {
    // "C#" Turkce parcada fonetige cevrilir; "database" Ingilizce sese gider.
    expect(segmentForSpeech('C# ile database tasarimi', 'tr')).toEqual([
      { text: 'si şarp ile', lang: 'tr' },
      { text: 'database', lang: 'en' },
      { text: 'tasarimi', lang: 'tr' },
    ])
  })

  it('uzun terim kisa terimden once eslesir', () => {
    const segments = segmentForSpeech('continuous deployment sureci', 'tr')
    expect(segments[0]).toEqual({ text: 'continuous deployment', lang: 'en' })
  })

  it('Ingilizce terim icermeyen Turkce metin tek parca kalir — sezgisel bolme YOK', () => {
    // "test", "proje", "problem" Ingilizce imlasina uyar ama Turkce'dir;
    // sezgisel bir dedektor bunlari kacirirdi.
    expect(segmentForSpeech('Bu test projesinde bir problem cozdunuz mu?', 'tr')).toEqual(
      [{ text: 'Bu test projesinde bir problem cozdunuz mu?', lang: 'tr' }],
    )
  })

  it('bos metin bos dizi dondurur', () => {
    expect(segmentForSpeech('   ', 'tr')).toEqual([])
  })

  it('terim listesinde tekrar yoktur', () => {
    expect(new Set(ENGLISH_VOICE_TERMS).size).toBe(ENGLISH_VOICE_TERMS.length)
  })
})

describe('splitIntoChunks (Chrome kesme davranisi — kriter 4)', () => {
  it('sinirin altindaki metin bolunmez', () => {
    expect(splitIntoChunks('Kisa bir soru.')).toEqual(['Kisa bir soru.'])
  })

  it('bos metin bos dizi dondurur', () => {
    expect(splitIntoChunks('   ')).toEqual([])
  })

  it('uzun metin cumle sinirlarindan bolunur', () => {
    const sentence = 'Bu bir ornek cumledir ve yeterince uzundur. '
    const chunks = splitIntoChunks(sentence.repeat(6))

    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(MAX_CHUNK_LENGTH)
    }
  })

  it('parcalarin birlesimi orijinal metni korur — icerik kaybi YOK', () => {
    const text =
      'Birinci cumle burada. Ikinci cumle biraz daha uzun olsun. ' +
      'Ucuncu cumle de ekleniyor ki toplam uzunluk siniri assin. ' +
      'Dorduncu cumle son.'

    expect(splitIntoChunks(text).join(' ')).toBe(text)
  })

  it('tek basina sinirdan uzun cumle kelime ortasindan BOLUNMEZ', () => {
    const longSentence = `${'kelime '.repeat(60).trim()}.`
    const chunks = splitIntoChunks(longSentence)

    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(MAX_CHUNK_LENGTH)
      expect(chunk.startsWith('kelime')).toBe(true)
    }
  })

  it('kisa cumleler gereksiz duraklama olmasin diye birlestirilir', () => {
    const chunks = splitIntoChunks('Bir. Iki. Uc.')
    expect(chunks).toEqual(['Bir. Iki. Uc.'])
  })
})
