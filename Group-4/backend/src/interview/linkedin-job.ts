// 009-linkedin-ilan-cekme: ilan baglantisindan is ilani metnini ceker.
//
// SSRF: dogrulamayla DEGIL, tasarimla (specs/009 §1). Kullanicinin verdigi URL
// hicbir zaman fetch'e verilmez; yalnizca sayisal ilan ID'si cikarilir ve sabit
// LinkedIn adresine eklenir. Hedefin tek degisken parcasi \d+ oldugundan
// kullanici girdisi sema, host, port veya yolu etkileyemez.
// BU TASARIM DEGISTIRILMEZ.
export const JOB_ID = /linkedin\.com\/jobs\/view\/(?:[^/]*-)?(\d+)/;

// Misafir ucu oturum/cerez istemez, yalnizca user-agent bekler. Sozlesmeye bagli
// DEGIL — haber verilmeden degisebilir (specs/009 §4, kabul edilmis kirilganlik).
const GUEST_ENDPOINT =
  'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting';

// Kullanici istek boyunca bekliyor: yanit vermeyen ucta suresiz asili kalmak
// yerine erken hata donulur. Yeniden deneme YOK (specs/009 §4).
const TIMEOUT_MS = 10_000;

export async function fetchLinkedInJob(url: string): Promise<string> {
  const id = JOB_ID.exec(url)?.[1];
  if (!id) throw new Error("Gecerli bir LinkedIn is ilani URL'si degil.");

  let res: Response;
  try {
    res = await fetch(`${GUEST_ENDPOINT}/${id}`, {
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // Ag hatasi/zaman asimi tek mesaja indirgenir: cagiran taraf bunu 400'e
    // cevirir, ham AbortError metni kullaniciya gosterilmez.
    throw new Error('LinkedIn ilanina ulasilamadi.');
  }
  if (!res.ok)
    throw new Error(`LinkedIn ilani okunamadi (HTTP ${res.status}).`);

  const html = await res.text();
  const markup = /<div class="show-more-less-html__markup[\s\S]*?<\/div>/.exec(
    html,
  )?.[0];
  if (!markup) throw new Error('Ilan aciklamasi bulunamadi.');

  const text = markup
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<li[^>]*>/g, '- ')
    .replace(/<\/(p|li|ul|ol|div)>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (text.length < 50) throw new Error('Ilan aciklamasi cok kisa.');
  return text;
}
