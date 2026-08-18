// unpdf icin test-zamani sahte modul — jest.mock('unpdf', () => require(...)).
//
// GEREKCE: unpdf'in gercek PDF.js motoru (`unpdf/pdfjs`) yalnizca ESM olarak
// dagitilir; ts-jest'in CommonJS derledigi test dosyalarindan dinamik import()
// Jest'in VM korumasina takilir (Node 24.9 altinda cozulemez — jest-runtime
// sinirlamasi, uygulamanin gercek calisma zamaninda GORULMEZ, node -e ile
// dogrulandi). PdfExtractionService'in SOZLESMESI (tip/boyut/bos-metin
// kontrolleri) test edilir; PDF.js'in kendi ayristirma dogrulugu ONUN
// sorumlulugu — plan.md: "somut kutuphane ADR-0009'a bagli, sozlesme sabit".
//
// Bu sahte, yuklenen "PDF" byte'larini DOGRUDAN metin olarak yankilar — testler
// gercek bir PDF byte yapisi kurmak yerine beklenen metni doğrudan yollar.
//
// TEK ISTISNA: bastaki `%PDF-...` satiri kirpilir. Servis artik icerikten tur
// dogrulamasi yapiyor (docs/SECURITY.md S10), yani fixture'lar gercek bir sihirli
// bayt tasimak ZORUNDA. O baytlari yankilanan metne karistirmak, testlerin
// olcmek istedigi icerigi kirletirdi (ozellikle "cikarilacak metin yok -> 422"
// senaryosunu imkansiz hale getirirdi).
const PDF_HEADER_LINE = /^%PDF-[^\n]*\n?/;

export async function getDocumentProxy(data: Uint8Array) {
  return { __bytes: data };
}

export async function extractText(
  pdf: { __bytes: Uint8Array },
  _opts?: unknown,
): Promise<{ text: string }> {
  const raw = Buffer.from(pdf.__bytes).toString('utf-8');
  return { text: raw.replace(PDF_HEADER_LINE, '') };
}
