# Mini Spec: Landing Page

Kaynak: `specs/007-ui-design/v2.pen` → "Screen - Landing" frame.

## Amaç
Ziyaretçiye ürünü tanıtıp login/mülakat başlatma akışına yönlendirmek.

## Bölümler

### 1. Nav
- Sol: logo (`images-removebg-preview.png`).
- Sağ: "Giriş yap" butonu (primary) → login ekranına gider.

### 2. Hero
- Başlık: "Gerçek ilanla, gerçek sorularla prova yap." (h1, 54px, bold)
- Alt metin: ürünün ne yaptığını açıklayan 2 cümle (ilan yapıştır → soru üret → cevapları değerlendir).
- CTA: "Mülakata başla" (primary buton, ok ikonlu) → interview oluşturma / kayıt akışına gider.
- Sağda mock önizleme kartı: soru sayacı + progress bar, örnek soru/cevap balonları, aktif soru + cevap input alanı, "Cevabı gönder" / "Kaydet ve çık" butonları. Statik illüstrasyon, tıklanabilir değil.

### 3. Nasıl Çalışır (Steps)
3 sütun, üstte ince ayırıcı çizgi:
1. **01 İlanı yapıştır** — Başvuracağın pozisyonun metnini ekle.
2. **02 Soruları yanıtla** — Karşına çıkan soruyu yanıtla, sonraki soruya geç.
3. **03 Raporunu al** — Güçlü yönlerin ve eksiklerin listelenir.

## Acceptance Criteria
1. Nav her zaman görünür, "Giriş yap" login ekranına navigate eder.
2. "Mülakata başla" CTA tıklanınca kayıt/login veya interview creation akışına yönlendirir (auth durumuna göre).
3. Hero mock kart yalnızca görsel, interaktif değil (statik preview).
4. Sayfa responsive: mobilde Hero tek sütuna düşer, Steps alt alta dizilir.
5. Tüm metinler Türkçe, tasarım tokenları (`$--primary`, `$--foreground`, `$--font-secondary` vb.) design system ile birebir kullanılır.

## Kapsam Dışı
- Fiyatlandırma, testimonial, footer, SEO — v2.pen'de yok, bu spec'e dahil edilmedi.
