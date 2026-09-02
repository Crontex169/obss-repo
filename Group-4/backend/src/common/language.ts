// DOSYA REHBERİ: Tarayıcının Accept-Language başlığına bakıp içeriğin Türkçe
// mi İngilizce mi üretileceğine karar veren küçük yardımcı fonksiyon. Karar
// bir kez verilir ve kayda (Interview.language) yazılır — sonradan tarayıcı
// dili değişse bile eski kayıt aynı dilde kalır.
// Cross-cutting dil cozumlemesi — docs/API_CONVENTIONS.md 4.2, FR-020.
// Insa sahibi: 002-interview. 003-pre-assessment bunu DEVRALIR.
//
// Kural: Accept-Language basligindaki EN YUKSEK oncelikli etiket "tr" ise tr,
// aksi halde en. Dil istek govdesinde TASINMAZ; uretilen kayit kendi dilini
// saklar (Interview.language) — arsivden okundugunda dil degismez.

// Tarayıcının  Accept-Language  başlığına bakıp içeriğin Türkçe mi İngilizce mi üretileceğine karar veren küçük yardımcı fonksiyon.
//  Karar bir kez verilir ve kayda ( Interview.language ) yazılır — sonradan tarayıcı dili değişse bile eski kayıt aynı dilde kalır.

export type AppLanguage = 'tr' | 'en';

export function resolveLanguage(acceptLanguage?: string): AppLanguage {
  if (!acceptLanguage) return 'en';

  // "tr-TR,tr;q=0.9,en-US;q=0.8" -> q degerine gore sirala, ilkine bak.
  const preferred = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params
        .map((p) => /^\s*q=([\d.]+)\s*$/.exec(p))
        .find((m): m is RegExpExecArray => m !== null);
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q[1]) : 1 };
    })
    .filter((entry) => entry.tag.length > 0)
    .sort((a, b) => b.q - a.q)[0];

  if (!preferred) return 'en';

  // Yalnizca birincil alt etiket "tr" olmali: "tzm-Latn-DZ" tr DEGILDIR.
  return preferred.tag.split('-')[0] === 'tr' ? 'tr' : 'en';
}
