import { z } from 'zod';
import { buildChatRequest } from '../../src/llm/providers/openai-compatible.provider';
import { QUESTION_GENERATION_TEMPERATURE } from '../../src/interview/llm/question-generation';
import { ADAPTIVE_TEMPERATURE } from '../../src/interview/llm/adaptive';
import { REPORT_TEMPERATURE } from '../../src/interview/llm/report';
import { COMPETENCY_REPORT_TEMPERATURE } from '../../src/pre-assessment/llm/competency-report.prompt';
import { GROQ_TEST_CONFIG, makeLlmService } from './helpers/make-llm-service';
import type { LlmCallArgs } from '../../src/llm/llm.provider';

// Ornekleme sicakligi. Deger VERILMEDIGINDE saglayici varsayilani (~1.0)
// gecerliydi; bu, PUANLAMA yapan cagrilarda ayni girdinin farkli skor
// uretmesi demekti. Burada iki sey korunur:
//   1) deger cagirandan saglayici govdesine BOZULMADAN gider,
//   2) verilmediginde alan govdede HIC yoktur (eski davranis aynen kalir).

const BASE_CALL_ARGS: LlmCallArgs = {
  jsonSchema: { type: 'object', properties: {}, required: [] },
  schemaName: 'probe',
  systemPrompt: 's',
  userData: 'd',
  timeoutMs: 1000,
  maxTokens: 100,
};

describe('LLM ornekleme sicakligi', () => {
  it('cagiranin verdigi deger saglayici govdesine gecer', () => {
    const body = buildChatRequest(GROQ_TEST_CONFIG, {
      ...BASE_CALL_ARGS,
      temperature: 0.4,
    });

    expect(body.temperature).toBe(0.4);
  });

  it('0 kaybolmaz — falsy oldugu icin dusurulurse rapor puani kararsiz kalirdi', () => {
    const body = buildChatRequest(GROQ_TEST_CONFIG, {
      ...BASE_CALL_ARGS,
      temperature: 0,
    });

    expect(body.temperature).toBe(0);
  });

  it('verilmezse alan govdede HIC yoktur (saglayici varsayilani korunur)', () => {
    const body = buildChatRequest(GROQ_TEST_CONFIG, BASE_CALL_ARGS);

    // `undefined` degeri DE kabul edilmez: alanin kendisi bulunmamali.
    expect('temperature' in body).toBe(false);
  });

  it('LlmService cagiranin degerini port sinirina tasir', async () => {
    const { service, fake } = makeLlmService();
    fake.always({ content: { ok: true } });

    await service.generateStructured({
      schema: z.object({ ok: z.boolean() }),
      schemaName: 'probe',
      systemPrompt: 's',
      userData: 'd',
      operation: 'interview_report',
      userId: 'user-1',
      temperature: REPORT_TEMPERATURE,
    });

    expect(fake.calls[0].temperature).toBe(REPORT_TEMPERATURE);
  });

  describe('operasyon basina secilen degerler', () => {
    // Degerlendirme cagrilari TEKRARLANABILIR olmak zorunda: ayni transcript
    // ayni skoru vermeli. Uretim cagrilari ise cesitlilik ister. Bu siralama
    // bozulursa rapor puani oynar — sabitlerin ilistigi tek yer burasi.
    it('degerlendirme cagrilari uretim cagrilarindan daha dusuk sicaklikta', () => {
      expect(REPORT_TEMPERATURE).toBeLessThan(ADAPTIVE_TEMPERATURE);
      expect(COMPETENCY_REPORT_TEMPERATURE).toBeLessThan(
        QUESTION_GENERATION_TEMPERATURE,
      );
      expect(ADAPTIVE_TEMPERATURE).toBeLessThan(
        QUESTION_GENERATION_TEMPERATURE,
      );
    });

    it('hepsi saglayicilarin kabul ettigi 0-2 araliginda', () => {
      for (const t of [
        QUESTION_GENERATION_TEMPERATURE,
        ADAPTIVE_TEMPERATURE,
        REPORT_TEMPERATURE,
        COMPETENCY_REPORT_TEMPERATURE,
      ]) {
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThanOrEqual(2);
      }
    });
  });
});
