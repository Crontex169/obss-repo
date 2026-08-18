import { z } from 'zod';
import { toProviderSchema } from '../../src/llm/schema-to-provider';

// T021 — Katman-1 sema regresyon testi.
// docs/API_CONVENTIONS.md 3.3: nicelik kisitlari saglayici semasindan CIKARILIR;
// "tam N soru" garantisi YALNIZCA katman-2 Zod dogrulamasindadir.
describe('toProviderSchema (katman 1)', () => {
  const questionGeneration = z.object({
    position: z.string().nullable(),
    questions: z
      .array(
        z.object({
          order: z.number().int(),
          type: z.enum(['multiple_choice', 'open_ended']),
          text: z.string().min(10),
          options: z.array(z.string().min(1)).max(6),
        }),
      )
      .min(1)
      .max(20),
  });

  const schema = toProviderSchema(questionGeneration);
  const asText = JSON.stringify(schema);

  it('desteklenmeyen nicelik anahtar sozcuklerini icermez', () => {
    for (const keyword of ['minLength', 'maxLength', 'minItems', 'maxItems']) {
      expect(asText).not.toContain(keyword);
    }
  });

  it('her nesnede additionalProperties: false vardir', () => {
    const objects: Record<string, unknown>[] = [];
    (function walk(node: unknown) {
      if (!node || typeof node !== 'object') return;
      const obj = node as Record<string, unknown>;
      if (obj.type === 'object') objects.push(obj);
      for (const value of Object.values(obj)) walk(value);
    })(schema);

    expect(objects.length).toBeGreaterThan(1);
    for (const obj of objects) {
      expect(obj.additionalProperties).toBe(false);
    }
  });

  it('tum alanlar required — strict mod opsiyonel alan kabul etmez', () => {
    expect(schema.required).toEqual(
      expect.arrayContaining(['position', 'questions']),
    );
  });

  it('opsiyonellik nullable union ile ifade edilir', () => {
    const position = (schema.properties as Record<string, any>).position;
    const variants = (position.anyOf ?? [{ type: position.type }]).flatMap(
      (v: any) => (Array.isArray(v.type) ? v.type : [v.type]),
    );
    expect(variants).toEqual(expect.arrayContaining(['string', 'null']));
  });

  // Groq strict dogrulayicisi anyOf'u cozmez: nullable alan anyOf olarak
  // giderse kendi urettigi null'i 400 json_validate_failed ile reddeder.
  it('nullable alan anyOf DEGIL tip dizisi olarak gider', () => {
    const position = (schema.properties as Record<string, any>).position;
    expect(position.anyOf).toBeUndefined();
    expect(position.type).toEqual(['string', 'null']);
  });

  it('nullable enum null degerini enum listesinde de tasir', () => {
    const withEnum = toProviderSchema(
      z.object({ rejection: z.enum(['not_a_job_posting']).nullable() }),
    );
    const rejection = (withEnum.properties as Record<string, any>).rejection;
    expect(rejection.type).toEqual(['string', 'null']);
    expect(rejection.enum).toEqual(['not_a_job_posting', null]);
  });

  it('gercek union bozulmaz — null dali olmayan anyOf korunur', () => {
    const union = toProviderSchema(
      z.object({ value: z.union([z.string(), z.number()]) }),
    );
    const value = (union.properties as Record<string, any>).value;
    expect(value.anyOf).toHaveLength(2);
  });

  it('$schema meta alani gonderilmez', () => {
    expect(schema).not.toHaveProperty('$schema');
  });

  it('katman 2 hala nicelik kisitini uygular — katman 1 gevsedi diye kaybolmaz', () => {
    const tooMany = {
      position: null,
      questions: Array.from({ length: 21 }, (_, i) => ({
        order: i + 1,
        type: 'open_ended' as const,
        text: 'yeterince uzun bir soru metni',
        options: [],
      })),
    };
    expect(questionGeneration.safeParse(tooMany).success).toBe(false);
  });
});
