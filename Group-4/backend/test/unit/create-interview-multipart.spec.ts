import { createInterviewSchema } from '../../src/interview/dto/create-interview.dto';

// Frontend gorusme olusturmayi HER ZAMAN multipart/form-data ile gonderir
// (lib/interview-client.ts createInterview -> FormData). Multipart'ta her alan
// STRING'dir: adaptiveEnabled "true" / "false" olarak gelir.
//
// Bu dosyanin var olma sebebi: entegrasyon testleri ayni ucu JSON govdeyle
// (gercek boolean ile) cagiriyor, yani multipart yolu hic dogrulanmiyordu.
// z.coerce.boolean() orada sessizce yanlis calisiyordu — Boolean("false") true
// oldugu icin adaptif akis KAPATILAMIYORDU ve her cevapta ek bir LLM cagrisi
// yapiliyordu.
describe('createInterviewSchema — multipart string degerleri', () => {
  const base = {
    jobPostingSource: 'text' as const,
    jobPostingText: 'Gecerli bir is ilani metni.',
    questionCount: '8',
    mode: 'written' as const,
    level: 'junior' as const,
  };

  it('adaptiveEnabled "false" string\'i false olur (regresyon)', () => {
    const parsed = createInterviewSchema.parse({
      ...base,
      adaptiveEnabled: 'false',
    });
    expect(parsed.adaptiveEnabled).toBe(false);
  });

  it('adaptiveEnabled "true" string\'i true olur', () => {
    const parsed = createInterviewSchema.parse({
      ...base,
      adaptiveEnabled: 'true',
    });
    expect(parsed.adaptiveEnabled).toBe(true);
  });

  it('JSON govde (gercek boolean) yolu bozulmadi', () => {
    expect(
      createInterviewSchema.parse({ ...base, adaptiveEnabled: false })
        .adaptiveEnabled,
    ).toBe(false);
    expect(
      createInterviewSchema.parse({ ...base, adaptiveEnabled: true })
        .adaptiveEnabled,
    ).toBe(true);
  });

  it('alan hic gonderilmezse varsayilan false', () => {
    expect(createInterviewSchema.parse(base).adaptiveEnabled).toBe(false);
  });

  it('boolean olmayan deger reddedilir (sessizce true olmaz)', () => {
    expect(
      createInterviewSchema.safeParse({ ...base, adaptiveEnabled: 'evet' })
        .success,
    ).toBe(false);
  });
});
