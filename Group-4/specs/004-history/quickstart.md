# Quickstart: Interview History (Görüşme Geçmişi) — Doğrulama Kılavuzu

**Dilim**: `004-history` | **Spec**: [spec.md](./spec.md) | **Sözleşme**: [contracts/history-api.md](./contracts/history-api.md)

Bu kılavuz, bu dilimin kabul kriterlerinin (Hikâye 1-5) uçtan uca nasıl doğrulanacağını
anlatır. Kod içermez; `speckit.tasks` + `speckit.implement` adımlarında yazılacak
testlerin (Jest/Supertest backend, Vitest+RTL frontend, Playwright e2e) senaryo temelidir
(İlke III — ATDD).

## Ön koşullar

- `002-interview` dilimi implemente edilmiş ve `Interview`/`Question`/`Answer`/`Report`
  tabloları migrate edilmiş olmalı (bu dilim onları **oluşturmaz**, tüketir).
- Yerel ortam: `docker-compose up` ile Postgres ayakta; `backend/.env` ve
  `frontend/.env` mevcut (bkz. `SETUP.md`).
- Test kullanıcısı: en az bir oturum açmış `role=user` hesabı.
- Test verisi: aşağıdaki senaryoları çalıştırmak için farklı durumlarda görüşme kayıtları
  gerekir (fixture/seed ile ya da gerçek akıştan — `002-interview` akışıyla — üretilir):
  1. 2 tamamlanmış (`status=completed`, `reportStatus=ready`) görüşme.
  2. 1 yarım kalmış (`status=in_progress`, bazı sorular cevaplanmış) görüşme.
  3. 1 tamamlanmış ama rapor üretimi başarısız (`reportStatus=failed`) görüşme.
  4. Başka bir kullanıcıya ait en az 1 görüşme (sahiplik/404 testi için).

## Çalıştırma

```powershell
# Backend
cd backend
npm install
npm run start:dev

# Frontend (ayrı terminal)
cd frontend
npm install
npm run dev
```

Test paketleri (implementasyon fazında):
```powershell
cd backend; npm run test          # Jest birim + Supertest entegrasyon
cd frontend; npm run test         # Vitest + RTL
npx playwright test               # e2e (repo kökünden, playwright kurulduktan sonra)
```

## Doğrulama Senaryoları

### S1 — Kart listeleme (Hikâye 1, FR-001–FR-004)

1. Test kullanıcısıyla giriş yapın, Dashboard → **Interview History** sekmesine gidin.
2. **Beklenen**: 2 tamamlanmış + 1 yarım kalmış kart görünür; her biri pozisyon adı,
   oluşturulma tarihi ve doğru rozeti ("Tamamlandı" x2, "Yarım Kaldı" x1) gösterir;
   en yeni kayıt en üstte (FR-003).
3. Başka bir kullanıcıya ait görüşmenin **hiç görünmediğini** doğrulayın.
4. Görüşmesi olmayan yeni bir test kullanıcısıyla girip **boş durum** mesajı + "Yeni
   Görüşme Başlat" CTA'sının göründüğünü doğrulayın (FR-004).
5. Bir görüşmeyi (bkz. S4) sildikten sonra listede **yer almadığını** doğrulayın (FR-001).

**Başarı ölçütü eşlemesi**: SC-001 (2 sn içinde liste görünür — manuel/otomatik zaman
ölçümü ile doğrulanabilir).

### S2 — Yarım kalmış görüşmeye devam etme (Hikâye 2, FR-005, FR-009, FR-014)

1. Yarım kalmış karttaki **"Devam Et"** aksiyonunu seçin.
2. **Beklenen**: soru-cevap ekranı açılır; önceki cevaplanmış soru/cevap çiftleri
   değişmeden görünür, ilk cevaplanmamış soru aktif soru olarak sunulur.
3. Ağ hatası simülasyonu (backend'i geçici durdurun veya fake ile 5xx döndürün):
   **Beklenen**: anlaşılır hata mesajı + "tekrar dene" seçeneği; görüşme durumu
   değişmez.
4. Aynı görüşmeyi başka bir sekmede tamamlayın (tüm sorulara cevap verin), sonra ilk
   sekmede eski "Devam Et" bağlantısını tekrar tetikleyin: **Beklenen**: kullanıcı
   otomatik olarak Görüşme Detayı ekranına yönlendirilir (FR-014).
5. Var olmayan/başkasına ait bir `id` ile doğrudan URL üzerinden devam etmeyi deneyin:
   **Beklenen**: "kayıt bulunamadı" mesajı; sahiplik bilgisi sızmaz (FR-009).

**Başarı ölçütü eşlemesi**: SC-002 (≥%95 başarılı devam etme — test setinde %100 olmalı).

### S3 — Tamamlanmış görüşme detayı (Hikâye 3, FR-007, FR-008)

1. Tamamlanmış ve raporu hazır bir kartı seçin.
2. **Beklenen**: Görüşme Detayı ekranı açılır; tüm sorular, cevaplar ve rapor
   (Teknik/Davranışsal/Genel skorları + metinsel geri bildirim) sırayla görüntülenir.
3. Rapor üretimi başarısız (`reportStatus=failed`) bir görüşmenin detayını açın:
   **Beklenen**: soru/cevap içeriği yine gösterilir; rapor bölümünde "rapor
   oluşturulamadı" bilgisi (+ varsa yeniden deneme seçeneği) görünür — sessiz
   başarısızlık yok.
4. Başka bir kullanıcının görüşme detayına doğrudan `id` ile erişmeyi deneyin:
   **Beklenen**: "kayıt bulunamadı" (Hikâye 2 kriter 4 ile aynı davranış).

**Başarı ölçütü eşlemesi**: SC-003 (Dashboard → History → kart seçimi = 3 etkileşimle
detay içeriğine erişim).

### S4 — Görüşmeyi silme (Hikâye 4, FR-010–FR-013)

1. Herhangi bir karttaki **"Sil"** aksiyonunu seçin.
2. **Beklenen**: onay istemi (`AlertDialog`) görünür.
3. Onayı **iptal edin**: **Beklenen**: görüşme silinmez, listede kalır (FR-010, kriter 4).
4. Aynı görüşmede "Sil" aksiyonunu tekrar seçip **onaylayın**: **Beklenen**: görüşme
   anında kullanıcı listesinden kaybolur (FR-011); `DELETE /api/interviews/:id` `204`
   döner.
5. Admin hesabıyla (varsa test admin kullanıcısı) aynı görüşmenin detayını görüntüleyin:
   **Beklenen**: kayıt hâlâ mevcut, "Silindi" rozetiyle, tüm soru/cevap/rapor içeriğiyle
   (FR-012) — *not: admin UI'ın kendisi `005-admin` diliminin kapsamıdır; bu adım yalnızca
   backend verisinin bozulmadığını API üzerinden (`role=admin` ile `GET`) doğrular.*
6. Aynı `id` için ikinci kez `DELETE` isteği gönderin: **Beklenen**: hata fırlatılmaz,
   `204` (idempotent) döner (FR-013).
7. Silinmiş görüşmenin eski "Devam Et"/"Detay" bağlantısına gidin: **Beklenen**: "kayıt
   bulunamadı" (FR-011, edge case).

**Başarı ölçütü eşlemesi**: SC-004 (kullanıcı listesinden %100 kaybolma + admin'de veri
kaybı yok), SC-005 (onay adımı sayesinde istemsiz silme yok).

### S5 — Rapor dışa aktarımı ve skor trendi (Hikâye 5, FR-016, FR-017)

> MVP kapsamındadır (2026-07-31 kararıyla Bonus'tan yükseltildi); diğer dört senaryo
> (S1-S4) tamamlandıktan sonra doğrulanır çünkü onların ürettiği veriye bağımlıdır.

1. Tamamlanmış/raporu hazır bir görüşme detayında "PDF olarak indir" aksiyonunu seçin:
   **Beklenen**: skorlar + metinsel geri bildirimi içeren bir dosya iner.
2. Aynı pozisyon için birden fazla tamamlanmış/raporlu görüşmeniz varsa, History
   sekmesinde trend görünümünü açın: **Beklenen**: skorların zaman içindeki değişimini
   gösteren bir grafik (Recharts, ADR-0011) görüntülenir.

## Sonraki Adım

Bu kılavuzdaki senaryolar `speckit.tasks` fazında somut test görevlerine (Jest/Supertest
entegrasyon testleri `DELETE /api/interviews/:id` için; Vitest+RTL bileşen testleri kart/
detay/onay diyaloğu için; Playwright e2e S1-S4 için) dönüştürülür. Kırmızı → Yeşil →
Refactor döngüsü uygulanır (İlke III); testler ilgili üretim kodundan **önce** yazılır.
