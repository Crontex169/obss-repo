import { resolveLanguage } from '../../src/common/language';

// T015 — FR-020 / docs/API_CONVENTIONS.md 4.2
// Accept-Language -> tr | en. TR disindaki HER deger en'e duser.
describe('resolveLanguage', () => {
  it.each([
    ['tr-TR', 'tr'],
    ['tr', 'tr'],
    ['TR-tr', 'tr'],
    ['tr-TR,tr;q=0.9,en-US;q=0.8', 'tr'],
  ])('%s -> %s', (header, expected) => {
    expect(resolveLanguage(header)).toBe(expected);
  });

  it.each([
    ['en-US', 'en'],
    ['en', 'en'],
    ['de-DE', 'en'],
    ['de-DE,de;q=0.9', 'en'],
    ['*', 'en'],
    ['', 'en'],
  ])('%s -> en', (header) => {
    expect(resolveLanguage(header)).toBe('en');
  });

  it('baslik yoksa en', () => {
    expect(resolveLanguage(undefined)).toBe('en');
  });

  it('turkce olmayan bir dil "tr" alt dizesi icerse bile en kalir', () => {
    // "central atlas tamazight" gibi bir etiket yanlislikla tr'ye dusmemeli
    expect(resolveLanguage('tzm-Latn-DZ')).toBe('en');
  });
});
