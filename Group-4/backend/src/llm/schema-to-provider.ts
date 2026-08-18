// DOSYA REHBERİ: Projenin iç veri tanımlama dilini (Zod) LLM sağlayıcısının
// anladığı JSON Schema formatına çevirir ve sağlayıcının desteklemediği bazı
// kuralları (minLength gibi) otomatik temizler. Bir çeviri bürosu gibi düşün:
// bizim dilimizi (Zod) karşı tarafın (Groq/DeepSeek) anlayacağı dile çevirir.
import { z } from 'zod';

// Katman 1 — Zod -> saglayici JSON Schema (docs/API_CONVENTIONS.md 3.3).
//
// Zod 4 `z.toJSONSchema()` yerlesiktir; ayri bir donusturucu paket GEREKMEZ.
// Groq `strict: true` constrained decoding kisitlari:
//   - tum alanlar required           -> Zod'da .optional() KULLANILMAZ, .nullable() kullanilir
//   - her nesnede additionalProperties: false
//   - minLength / maxLength / minItems / maxItems DESTEKLENMEZ -> cikarilir
//
// Cikarilan nicelik kisitlari katman 2'de (runtime Zod) hala uygulanir; "tam N soru"
// garantisi oradan gelir.
//
// Nullable alanlar: Zod `anyOf: [X, {type:'null'}]` uretir, ama Groq'un strict
// dogrulayicisi anyOf'u cozmez — ilk dali alip `type: string` dayatir ve kendi
// urettigi `null` degerini 400 json_validate_failed ile reddeder. draft-7 tip
// dizisine (`type: ['string','null']`) daraltilir; enum'a da null eklenir.

const UNSUPPORTED_KEYWORDS = [
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'minProperties',
  'maxProperties',
  'pattern',
  'format',
  '$schema',
] as const;

export type ProviderJsonSchema = Record<string, unknown> & {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
};

export function toProviderSchema(schema: z.ZodType): ProviderJsonSchema {
  const json = z.toJSONSchema(schema, {
    target: 'draft-7',
    io: 'output',
    // Desteklenmeyen yapiyi sessizce atlamak yerine gorunur kilar (Ilke VI).
    unrepresentable: 'throw',
  });
  return sanitize(json) as ProviderJsonSchema;
}

// `anyOf: [X, {type:'null'}]` -> `{...X, type: [X.type, 'null']}`. Iki daldan
// biri `type: 'null'` DEGILSE veya oteki dalin `type`'i tek bir string degilse
// dokunulmaz — gercek bir union'i bozmaz.
function collapseNullable(
  node: Record<string, unknown>,
): Record<string, unknown> {
  const branches = node.anyOf;
  if (!Array.isArray(branches) || branches.length !== 2) return node;

  const nullIndex = branches.findIndex(
    (branch) => (branch as { type?: unknown } | null)?.type === 'null',
  );
  if (nullIndex === -1) return node;

  const other = branches[1 - nullIndex] as Record<string, unknown>;
  if (typeof other?.type !== 'string') return node;

  // anyOf birlestirilmis type dizisiyle degistirilir; ayiklanan alan
  // kullanilmaz, bu yuzden rest'e alinmadan dusurulur.
  const rest = { ...node };
  delete rest.anyOf;
  const merged: Record<string, unknown> = {
    ...other,
    ...rest,
    type: [other.type, 'null'],
  };
  // Nullable enum: null enum'da da yer almazsa dogrulayici yine reddeder.
  if (Array.isArray(other.enum)) {
    merged.enum = [...(other.enum as unknown[]), null];
  }
  return merged;
}

function sanitize(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitize);
  if (!node || typeof node !== 'object') return node;

  const collapsed = collapseNullable(node as Record<string, unknown>);

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(collapsed)) {
    if ((UNSUPPORTED_KEYWORDS as readonly string[]).includes(key)) continue;
    out[key] = sanitize(value);
  }

  if (out.type === 'object') {
    out.additionalProperties = false;
    // strict: her ozellik required olmali (opsiyonellik nullable ile ifade edilir).
    out.required = Object.keys(out.properties ?? {});
  }

  return out;
}
