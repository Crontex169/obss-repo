import { describe, it, expect } from 'vitest'
import {
  buildPreQuestionSpeech,
  pickTransition,
} from '@/lib/speech/interview-script'

// FR-037 / FR-038 — Hikaye 2, kriter 1, 5 ve 6.

const POOL = ['Tesekkurler, devam edelim.', 'Anladim, siradaki soru.']

function args(overrides: Partial<Parameters<typeof buildPreQuestionSpeech>[0]>) {
  return {
    isFirstQuestion: false,
    greeting: 'Merhaba, hos geldiniz.',
    interviewerRemark: null,
    transitionPool: POOL,
    questionIndex: 0,
    ...overrides,
  }
}

describe('buildPreQuestionSpeech', () => {
  it('ilk soruda KARSILAMA yapilir, gecis degil (kriter 1)', () => {
    expect(buildPreQuestionSpeech(args({ isFirstQuestion: true }))).toEqual([
      'Merhaba, hos geldiniz.',
    ])
  })

  it('ilk soruda replik gelse bile karsilama onceliklidir', () => {
    expect(
      buildPreQuestionSpeech(
        args({ isFirstQuestion: true, interviewerRemark: 'Tesekkurler.' }),
      ),
    ).toEqual(['Merhaba, hos geldiniz.'])
  })

  it('sonraki sorularda sunucudan gelen replik kullanilir (kriter 5)', () => {
    expect(
      buildPreQuestionSpeech(
        args({ interviewerRemark: 'Projeden bahsettiniz, tesekkurler.' }),
      ),
    ).toEqual(['Projeden bahsettiniz, tesekkurler.'])
  })

  it('replik YOKSA sablon gecisine dusulur — akis sessiz kalmaz', () => {
    expect(buildPreQuestionSpeech(args({ interviewerRemark: null }))).toEqual([
      POOL[0],
    ])
  })

  it('replik bos/bosluk ise sablon gecisi kullanilir', () => {
    expect(buildPreQuestionSpeech(args({ interviewerRemark: '   ' }))).toEqual([
      POOL[0],
    ])
  })

  it('replik bastaki/sondaki bosluklardan arindirilir', () => {
    expect(
      buildPreQuestionSpeech(args({ interviewerRemark: '  Tesekkurler.  ' })),
    ).toEqual(['Tesekkurler.'])
  })

  it('havuz bos ve replik yoksa hic metin uretilmez (bos utterance gonderilmez)', () => {
    expect(
      buildPreQuestionSpeech(args({ transitionPool: [], interviewerRemark: null })),
    ).toEqual([])
  })
})

describe('pickTransition', () => {
  it('havuzda sirayla doner — arka arkaya ayni cumle duyulmaz', () => {
    expect(pickTransition(POOL, 0)).toBe(POOL[0])
    expect(pickTransition(POOL, 1)).toBe(POOL[1])
    expect(pickTransition(POOL, 2)).toBe(POOL[0])
  })

  it('bos havuzda bos metin doner, hata firlatmaz', () => {
    expect(pickTransition([], 3)).toBe('')
  })
})
