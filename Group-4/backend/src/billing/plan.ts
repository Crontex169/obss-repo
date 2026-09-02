// DOSYA REHBERİ: Plan kademesi ve aylık kota matrisinin TEK kaynağı. Etkin plan
// veritabanında saklanmaz; kullanıcının planTier + proUntil alanlarından burada
// türetilir. Kota limitleri DB'de değil burada sabittir.
// bkz. specs/010-odeme-abonelik/data-model.md
//
// Neden DB'de bir "plan" kolonu yok: abonelik durum makinesinin (aktif, iptal,
// gecikmis, suresi dolmus) sahibi odeme saglayicisidir. Ikinci bir kopyasini
// tutsaydik iki kaynak ayrisabilir ve faturasi kullaniciya cikardi (parasini
// odeyip ucretsiz planda kalmak). Burada saklanan sey durum degil SONUCTUR:
// hangi kademe, ne zamana kadar.
export type PlanTier = 'free' | 'pro' | 'pro_plus';

// Kota matrisi kodda sabittir, DB'de degil: tek bir plan matrisi var ve yonetim
// arayuzunden degistirilmiyor, tabloya tasimak uc satirlik hic yazilmayan bir
// tablo demek olurdu. Limit degisimi kod degisikligi + dagitim gerektirir.
const MONTHLY_QUOTA: Record<PlanTier, number> = {
  free: 3,
  pro: 50,
  pro_plus: 100,
};

export function monthlyQuotaFor(plan: PlanTier): number {
  return MONTHLY_QUOTA[plan];
}

/**
 * Etkin plan. proUntil gecmisse veya yoksa kullanici `free`dir; planTier gecmis
 * bir donemle birlikte kayitta KALIR ama hicbir hak vermez — en son hangi
 * kademede oldugu bilgisi (yeniden abone olma akisi ve destek icin) korunur.
 *
 * planTier taninmayan bir deger tutuyorsa GUVENLI TARAFA (free) duseriz: bozuk
 * ya da elle degistirilmis bir kayit hak KAZANDIRMAMALI.
 */
export function resolvePlan(user: {
  planTier: string | null;
  proUntil: Date | null;
}): PlanTier {
  if (!user.proUntil || user.proUntil.getTime() <= Date.now()) return 'free';
  if (user.planTier === 'pro' || user.planTier === 'pro_plus') {
    return user.planTier;
  }
  return 'free';
}

/**
 * Kota penceresinin baslangici: icinde bulunulan ayin 1'i 00:00 UTC.
 *
 * UTC sart: sunucunun yerel saat dilimi kullanilsaydi pencere sunucunun nerede
 * calistigina gore kayar, ayin ilk/son saatlerinde kullanicinin hakki sunucu
 * tasindiginda degisirdi.
 */
export function currentMonthStartUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
