# Sözleşme: Yetkilendirme Kuralları (Rol & Sahiplik)

**Dilim**: `001-auth-rol` | **Uygulama**: NestJS Guard'lar (sunucu tarafı — FR-011, İlke V)

Bu belge, rol tabanlı ve sahiplik tabanlı erişim kurallarını **sözleşme** olarak tanımlar.
Tüm kontroller sunucu tarafında yapılır; istemci kontrolleri yalnızca UX içindir ve
baypas edilebilir sayılır (Hikâye 5 kriter 4). Guard tasarımı için bkz. research.md §5.

---

## Guard Zinciri

1. **`SessionGuard`** — Better Auth oturumunu doğrular (`GET get-session`). Oturum yoksa/geçersizse
   `401`. Başarıda `request.user` (id, email, role) ve `request.session` doldurulur.
2. **`RolesGuard`** + `@Roles(...)` — `request.user.role` ile gerekli rolü karşılaştırır; uymazsa `403`.
3. **`OwnershipGuard`** — kaynak `ownerId === request.user.id` mı kontrol eder; admin okuma için baypas.

> Not: Bu dilimde korunan gerçek kaynak (görüşme/rapor) henüz yoktur. Guard'lar ve sözleşme
> **şimdi kurulur**; sonraki dilimler kaynaklarını bu guard'lara bağlar (spec Kapsam Notu).
>
> ⚠️ **Sonraki dikeyler için daraltma (çapraz analiz, 2026-07-30):** Aşağıda sahiplik
> hatası için bırakılan `403` **veya** `404` seçimi, gerçek kaynak taşıyan dikeylerde
> **`404` olarak kilitlenmiştir** — `403` kaydın var olduğunu açığa çıkarır
> (`docs/API_CONVENTIONS.md` §1). Bu dilimin kendi uç noktaları etkilenmez (korunan kaynak
> yok); kural `002-interview` ve sonrası için bağlayıcıdır. Rol yetersizliği `403` kalır.

---

## Rol → Erişim Matrisi

| Kaynak / Eylem | Anonim | Kullanıcı (user) | Admin |
|----------------|:------:|:----------------:|:-----:|
| Kayıt / Giriş uç noktaları | ✅ | ✅ | ✅ (yalnız e-posta/şifre) |
| Kendi oturumu / çıkış | ❌ | ✅ | ✅ |
| Admin paneli uç noktaları | ❌ | ❌ (`403`) | ✅ |
| Başka kullanıcının verisini okuma | ❌ | ❌ (`403`) | ✅ (okuma) |
| Kendi verisini okuma/yazma | ❌ | ✅ | ✅ |

**İzlenebilirlik**: FR-008 (admin paneli yalnız admin), FR-009 (kendi verisi), FR-010
(admin tüm veriye okuma), SC-003 (%100 yetkisiz ret), SC-004 (%100 admin paneli ret).

---

## Kural Detayları

### R1 — Admin paneli erişimi (FR-008)
- `@Roles('admin')` ile korunur. `role !== 'admin'` → `403`. *(Hikâye 4 kriter 2; SC-004)*

### R2 — Sahiplik: kendi verisi (FR-009)
- Kaynağın `ownerId`'si oturumdaki `user.id` ile eşleşmezse (ve kullanıcı admin değilse)
  → `403`, içerik **sızdırılmaz**. *(Hikâye 5 kriter 1; SC-003)* — Bu dilimde korunan
  gerçek kaynak henüz yok (yukarıdaki not); `002-interview` ve sonrası kendi
  `OwnershipGuard`'ında `404`'e kilitlenmiştir (`docs/API_CONVENTIONS.md` §1).

### R3 — Admin okuma erişimi (FR-010)
- `role === 'admin'` → tüm kullanıcıların kayıtlarına **okuma** erişimi (yazma bu dilimde tanımsız).
  *(Hikâye 5 kriter 3)*

### R4 — İstemci baypası (FR-011, Hikâye 5 kriter 4)
- İstek doğrudan API'ye yapılsa bile guard zinciri çalışır; istemci tarafı gizleme yetki sağlamaz.

### R5 — Rol claim kaynağı
- Rol, oturum/kullanıcı nesnesinden (DB destekli) okunur; **istemciden gelen role güvenilmez**.
- Oturum açıkken rol değişirse (Edge Case), sonraki isteklerde güncel rol DB'den okunur.

---

## Hata Yanıtı Sözleşmesi (yetkilendirme)

| Durum | Kod | Not |
|-------|-----|-----|
| Oturum yok/geçersiz | `401` | Yeniden giriş iste (FR-013, SC-006) |
| Rol yetersiz | `403` | Genel "yetkisiz erişim" (FR-014) |
| Sahiplik yok (bu dilimde, korunan kaynak yok) | `403` | İçerik sızdırma yok (SC-003); `002-interview`+ için `404` kilitli (bkz. yukarı not) |

Tüm mesajlar genel; hesap/kaynak varlığını ve hangi kontrolün başarısız olduğunu açığa
çıkarmaz (FR-014, SC-007).
