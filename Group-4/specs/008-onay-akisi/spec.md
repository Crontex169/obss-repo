# Onay Akışı: Kullanım Şartları, Gizlilik Politikası ve KVKK

**Feature Branch**: `fix/71-onay-akisi-gate`

**Created**: 2026-08-07

**Status**: Approved

**Input**: Issue #71 — "Kullanım şartları gizlilik için buton var ama içerik yok ve google ile giriş yapanlar bypass edebiliyo"

## 1. Problem

Mevcut durumda üç ayrı kusur var:

1. **Onay sunucuya hiç ulaşmıyor.** `frontend/src/components/auth/register-form.tsx` içindeki "Kullanım Şartları'nı ve Gizlilik Politikası'nı okudum, onaylıyorum" onay kutusu yalnızca istemci state'idir; kayıt isteğinde böyle bir alan gönderilmez. Onay, doğrudan API çağrısıyla atlanabilir.
2. **Google ile giriş onayı tamamen atlıyor.** `GoogleButton`, onay kutusunun işaretli olup olmadığına bakmaz. Google akışıyla kaydolan kullanıcı hiçbir onay vermemiş olur.
3. **Onaylanan metin hiçbir yerde yok.** "Kullanım Şartları" ve "Gizlilik Politikası" için ne bir sayfa, ne bir dialog, ne bir i18n metni bulunuyor. Etiket tıklanabilir bile değil.

Buna ek olarak, çalışan KVKK aydınlatma popup'ında dördüncü bir boşluk var: `KvkkConsentDialog` yalnızca `pages/dashboard.tsx` içinde mount edilmiştir. Oturum açtıktan sonra doğrudan `/settings` veya `/interview/new` adresine giden kullanıcı popup'ı hiç görmez.

## 2. Çözüm Özeti

Onay toplama noktası kayıt formundan alınıp, oturum açtıktan sonra gösterilen tek bir engelleyici (blocking) onay kapısına taşınır. Kapı sunucudaki `user.kvkkConsentAt` alanına bakar; bu alan boş olduğu sürece kullanıcı uygulamayı kullanamaz. Kayıt yolu (e-posta veya Google) fark etmez, çünkü kapı kayıt akışının değil oturumun bir parçasıdır.

## 3. Kullanıcı Senaryoları

### US1 — İlk girişte onay kapısı (P1)

Yeni kaydolan kullanıcı (e-posta ya da Google fark etmez) oturum açtığında karşısına kapatılamayan bir popup çıkar. Popup'ta bir karşılama başlığı, kısa bir CTA metni ve iki satır onay kutusu vardır:

1. KVKK Aydınlatma Metni
2. Kullanım Şartları ve Gizlilik Politikası

**Kabul Kriterleri**

1. **Given** `kvkkConsentAt` alanı boş bir kullanıcı, **When** herhangi bir korumalı sayfayı açar, **Then** onay kapısı görünür ve arkadaki içerik kullanılamaz.
2. **Given** onay kapısı açık, **When** kullanıcı Escape'e basar veya dışarı tıklar, **Then** popup kapanmaz.
3. **Given** onay kapısı açık, **When** iki onay kutusundan yalnızca biri işaretlidir, **Then** devam butonu pasiftir.
4. **Given** her iki onay kutusu işaretli, **When** kullanıcı devam butonuna basar, **Then** `POST /api/users/me/kvkk-consent` çağrılır, popup kapanır ve bir daha gösterilmez.

### US2 — Belge metnini okuma (P1)

Kullanıcı, onay kutusu satırındaki belge adına tıklayarak o belgenin tam metnini ikinci bir dialogda okur.

**Kabul Kriterleri**

1. **Given** onay kapısı açık, **When** kullanıcı "KVKK Aydınlatma Metni" bağlantısına tıklar, **Then** KVKK metnini bölümler hâlinde gösteren ikinci bir dialog açılır.
2. **Given** onay kapısı açık, **When** kullanıcı "Kullanım Şartları ve Gizlilik Politikası" bağlantısına tıklar, **Then** o belgenin tam metnini gösteren ikinci bir dialog açılır.
3. **Given** belge dialogu açık, **When** kullanıcı kapatır, **Then** onay kapısı ve işaretlenmiş kutular korunarak geri döner.

### US3 — Kayıt formunun sadeleşmesi (P2)

Kayıt formunda artık onay kutusu yoktur; yerine yalnızca bilgilendirici bir not bulunur. Böylece e-posta ile kayıt ile Google ile kayıt arasındaki asimetri ortadan kalkar.

**Kabul Kriterleri**

1. **Given** kayıt formu, **When** sayfa açılır, **Then** onay kutusu yoktur ve bilgilendirme notu görünür.
2. **Given** geçerli form verileri, **When** kullanıcı kaydol butonuna basar, **Then** onay kutusu kaynaklı bir doğrulama hatası oluşmaz.

## 4. Teknik Tasarım

### Bileşenler

| Dosya | Değişiklik |
| --- | --- |
| `frontend/src/components/consent-gate-dialog.tsx` | Yeni. Mevcut `kvkk-consent-dialog.tsx` yerine geçer. Karşılama + CTA + iki onay kutusu + devam butonu. |
| `frontend/src/components/legal-document-dialog.tsx` | Yeni. İkinci seviye belge dialogu. Bölüm listesini i18n namespace'inden okur; iki belge de aynı bileşeni kullanır. |
| `frontend/src/App.tsx` | `withShell` içine onay kapısı eklenir. |
| `frontend/src/pages/dashboard.tsx` | Üç mükerrer `KvkkConsentDialog` kullanımı kaldırılır. |
| `frontend/src/components/auth/register-form.tsx` | Onay kutusu ve `consentRequiredError` doğrulaması kaldırılır, bilgilendirme notu eklenir. |

### i18n

İki hukuki belge aynı şekli paylaşır (`{ title, sections }`), böylece tek bir dialog bileşeni ikisini de render eder. Arayüz metinleri belgelerden ayrı bir namespace'te durur.

- `kvkkConsent.json` (TR/EN): yalnızca KVKK belgesi. Popup'a ait `checkboxLabel`, `accept`, `accepting` anahtarları buradan çıkarılır.
- `terms.json` (TR/EN): yeni namespace. Kullanım Şartları ve Gizlilik Politikası tek belge, bölümlü. İçerik uygulamanın gerçek davranışını yansıtır: yapay zekâ üretimi içeriğin garanti edilmemesi, Groq/DeepSeek'e veri aktarımı, iki yıllık saklama süresi, hesap silme hakkı.
- `consentGate.json` (TR/EN): yeni namespace. Karşılama, CTA, açıklama, iki onay satırı (`prefix` + tıklanabilir `link` + `suffix`) ve buton metinleri.
- `common.json` (TR/EN): belge dialogunun kapatma butonu için `close` anahtarı eklenir.

### Veri modeli ve API

Değişiklik yoktur. İki onay kutusu da zorunlu olduğundan ve aynı anda işaretlendiğinden, tek `user.kvkkConsentAt` zaman damgası her iki belgenin kabulünü kaydeder. `GET /api/users/me` ve `POST /api/users/me/kvkk-consent` uçları olduğu gibi kalır.

### Hata yönetimi

Mevcut davranış korunur: onay durumu okunamazsa popup zorlanmaz, kullanıcı akıştan alıkonmaz. Kabul isteği başarısız olursa popup açık kalır ve buton yeniden aktifleşir.

## 5. Test

- `frontend/test/consent-gate.test.tsx` (yeni): iki onay kutusunun varlığı, tek kutu işaretliyken butonun pasif kalması, belge bağlantısının ikinci dialogu açması.
- `frontend/test/register-form.test.tsx`: onay kutusu tıklaması kaldırılır.
- `frontend/test/e2e/auth-flows.spec.ts`: kayıt akışındaki onay kutusu adımı kaldırılır.
- `frontend/test/e2e/interview-flows.spec.ts`: `mockSession` yardımcısı `GET /api/users/me` için onaylı bir kullanıcı döndürür; aksi hâlde kapı artık her korumalı rotada açıldığı için tüm senaryoların önüne geçerdi.
- `frontend/test/i18n-parity.test.ts`: yeni namespace'i otomatik kapsar, ek değişiklik gerekmez.
- `backend/test/integration/kvkk-consent.spec.ts`: değişmez, olduğu gibi geçmelidir.

## 6. Kapsam Dışı

- Public `/terms` ve `/privacy` route'ları. Google OAuth doğrulama ekranı için ileride gerekebilir; ayrı bir iş olarak ele alınacak.
- Belge sürümleme ve sürüm değişince yeniden onay isteme.
- Belge bazlı ayrı zaman damgaları (`termsAcceptedAt`).
