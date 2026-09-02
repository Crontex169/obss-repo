// 010-odeme-abonelik T007: plan turetimi ve kota matrisi.
// Etkin plan VERITABANINDA SAKLANMAZ; planTier + proUntil'den turetilir.
// Bu testler o turetimin ve kota penceresinin tek dogruluk kaynagidir.
import {
  resolvePlan,
  monthlyQuotaFor,
  currentMonthStartUtc,
} from '../../src/billing/plan';

describe('resolvePlan', () => {
  const future = new Date(Date.now() + 86_400_000);
  const past = new Date(Date.now() - 86_400_000);

  it('proUntil null -> free', () => {
    expect(resolvePlan({ planTier: null, proUntil: null })).toBe('free');
  });

  it('proUntil gecmis -> free (planTier dolu olsa bile)', () => {
    expect(resolvePlan({ planTier: 'pro', proUntil: past })).toBe('free');
  });

  it('proUntil gelecek -> planTier', () => {
    expect(resolvePlan({ planTier: 'pro_plus', proUntil: future })).toBe(
      'pro_plus',
    );
  });

  it('proUntil gelecek ama planTier null -> free (tutarsiz kayit guvenli tarafa duser)', () => {
    expect(resolvePlan({ planTier: null, proUntil: future })).toBe('free');
  });

  it('planTier taninmayan bir deger -> free', () => {
    expect(resolvePlan({ planTier: 'altin', proUntil: future })).toBe('free');
  });
});

describe('monthlyQuotaFor', () => {
  it('kademe basina kota', () => {
    expect(monthlyQuotaFor('free')).toBe(3);
    expect(monthlyQuotaFor('pro')).toBe(50);
    expect(monthlyQuotaFor('pro_plus')).toBe(100);
  });
});

describe('currentMonthStartUtc', () => {
  it('ayin ilk gunu 00:00 UTC dondurur', () => {
    const d = currentMonthStartUtc(new Date('2026-09-17T13:45:00Z'));
    expect(d.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('ayin ilk saniyesinde o ayi dondurur (bir onceki ayi DEGIL)', () => {
    const d = currentMonthStartUtc(new Date('2026-09-01T00:00:00Z'));
    expect(d.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('yerel saat dilimi degil UTC kullanir', () => {
    // UTC+3'te bu an 1 Ekim 02:00, ama UTC'de hala 30 Eylul 23:00 -> Eylul penceresi
    const d = currentMonthStartUtc(new Date('2026-09-30T23:00:00Z'));
    expect(d.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('yil sinirini dogru gecer (Ocak)', () => {
    const d = currentMonthStartUtc(new Date('2027-01-05T10:00:00Z'));
    expect(d.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});
