import { createInterviewSchema } from '../../src/interview/dto/create-interview.dto';

// Kalici CV profili: kayitli CV bu gorusmede kullanilsin mi bilgisi multipart
// govdeyle STRING olarak gelir (frontend'in tek yolu FormData'dir). Varsayilan
// true oldugu icin en riskli hata "false"un true'ya donmesidir — kullanici
// kutuyu kaldirmasina ragmen CV'si yine promptta olurdu.
describe('createInterviewSchema — useStoredCv', () => {
  const base = {
    jobPostingSource: 'text' as const,
    jobPostingText: 'Gecerli bir is ilani metni.',
    questionCount: '8',
    mode: 'written' as const,
    level: 'junior' as const,
  };

  it('alan gonderilmezse varsayilan true (kayitli CV kullanilir)', () => {
    expect(createInterviewSchema.parse(base).useStoredCv).toBe(true);
  });

  it('"false" string\'i false olur (Boolean("false") tuzagi)', () => {
    expect(
      createInterviewSchema.parse({ ...base, useStoredCv: 'false' })
        .useStoredCv,
    ).toBe(false);
  });

  it('"true" string\'i ve gercek boolean ayni sonucu verir', () => {
    expect(
      createInterviewSchema.parse({ ...base, useStoredCv: 'true' }).useStoredCv,
    ).toBe(true);
    expect(
      createInterviewSchema.parse({ ...base, useStoredCv: false }).useStoredCv,
    ).toBe(false);
  });

  it('boolean olmayan deger reddedilir', () => {
    expect(
      createInterviewSchema.safeParse({ ...base, useStoredCv: 'hayir' })
        .success,
    ).toBe(false);
  });
});
