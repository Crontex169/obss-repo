// DOSYA REHBERİ: Süreç içi (in-process) küçük bir önbellek. Aynı girdi için
// pahalı bir işi (dış istek, PDF ayrıştırma) tekrar tekrar yapmamak için var.
//
// KAPSAM — bilerek dar tutuldu:
//  - Yalnizca bu SUREC icinde yasar. Birden fazla ornek calisiyorsa her birinin
//    kendi kopyasi olur ve yeniden baslatmada bosalir. Dogruluk buna BAGLI
//    OLMAMALIDIR: onbellek yalnizca tekrari ucuzlatir, kural uygulamaz.
//  - Bu yuzden siklik siniri (rate limit) gibi GUVENLIK sayaclarinda
//    kullanilmaz; orada surec-yerel sayac zaten bulunan bir eksiktir.
//
// ttlMs <= 0 => onbellek tamamen KAPALI (yazma da okuma da yok). Testler ve
// operasyon icin tek dugme: davranisi kod degistirmeden kapatabilmek.
export class TtlCache<V> {
  private readonly entries = new Map<string, { expiresAt: number; value: V }>();

  constructor(
    private readonly ttlMs: number,
    // Bellek tavani: onbellek kendi basina bir bellek sizintisi olmamalidir.
    // Dolunca EN ESKI giren atilir (Map ekleme sirasini korur).
    private readonly maxEntries: number,
  ) {}

  get(key: string): V | undefined {
    if (this.ttlMs <= 0) return undefined;
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    if (Date.now() >= hit.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: V): void {
    if (this.ttlMs <= 0) return;
    // Once sil, sonra ekle: anahtar zaten varsa Map onu ESKI sirasinda tutar
    // ve tazelenen kayit siradaki ilk kurban olurdu.
    this.entries.delete(key);
    this.entries.set(key, { expiresAt: Date.now() + this.ttlMs, value });
    // Map ekleme sirasinda gezilir; bastan silmek en eskiyi atar.
    for (const oldest of this.entries.keys()) {
      if (this.entries.size <= this.maxEntries) break;
      this.entries.delete(oldest);
    }
  }
}
