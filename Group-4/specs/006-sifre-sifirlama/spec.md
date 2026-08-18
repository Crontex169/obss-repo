# Feature Specification: Şifre Sıfırlama (Password Reset)

**Feature Branch**: `006-sifre-sifirlama`

**Created**: 2026-08-03

**Status**: Draft

**Input**: User description: "Kullanıcı şifresini unuttuğunda e-posta ile şifre sıfırlama isteği gönderebilmeli, sistem güvenli bir tek-kullanımlık süreli sıfırlama linki e-posta ile göndermeli, kullanıcı bu linkle yeni şifre belirleyebilmeli. Google-only hesaplar ve var olmayan e-postalar için sistem bilgi sızdırmamalı (email enumeration koruması, mevcut auth sisteminin FR-003/FR-014 mantığıyla tutarlı). İstek sıklığı sınırlandırılmalı (mevcut FR-017 throttling mantığıyla tutarlı)."

> **Not (kapsam/önceki karar ile ilişki)**: Bu spec, `001-auth-rol/tasks.md` içindeki **T077** bulgusunu ("Şifre sıfırlama ucunu kapat veya `NOT_IMPLEMENTED` fırlat" — bulgu A4) **süpersede eder**. O zamanki karar, şifre sıfırlamanın kapsam dışı bırakılmasıydı; bu spec ile artık gerçek uçtan uca şifre sıfırlama akışı talep edilmektedir. Bkz. `specs/001-auth-rol/tasks.md` T077 satırındaki referans notu.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Şifre sıfırlama isteği gönderme (Priority: P1)

Şifresini unutan bir kullanıcı, giriş ekranındaki "Şifremi unuttum" akışından e-posta adresini girerek şifre sıfırlama isteği gönderir. Sistem, girilen e-posta gerçekten parola tabanlı bir hesaba ait olsun ya da olmasın, kullanıcıya her zaman aynı genel bilgilendirme mesajını gösterir; yalnızca gerçek ve parola tabanlı bir hesap için arka planda bir e-posta gönderilir.

**Why this priority**: Bu, tüm akışın giriş noktasıdır; bu olmadan kullanıcı şifresini sıfırlayamaz. Aynı zamanda e-posta enumeration koruması burada uygulanır, bu yüzden en yüksek önceliklidir.

**Independent Test**: Var olan bir parola tabanlı hesabın e-postası ile istek gönderilerek test edilebilir; sıfırlama e-postasının alıcıya ulaştığı ve kullanıcıya genel bir "e-posta gönderildi" mesajı gösterildiği doğrulanarak bağımsız olarak teslim edilebilir bir değer sağlar.

**Acceptance Scenarios**:

1. **Given** sistemde kayıtlı, parola tabanlı bir hesabın e-postası, **When** kullanıcı bu e-posta ile şifre sıfırlama isteği gönderir, **Then** sistem genel bir "e-posta adresiniz sistemde kayıtlıysa bir sıfırlama bağlantısı gönderildi" mesajı gösterir ve kullanıcının e-postasına tek kullanımlık, süreli bir sıfırlama bağlantısı gönderilir.
2. **Given** sistemde kayıtlı olmayan bir e-posta adresi, **When** kullanıcı bu e-posta ile şifre sıfırlama isteği gönderir, **Then** sistem User Story 1 - Senaryo 1 ile birebir aynı genel mesajı gösterir ve hiçbir e-posta gönderilmez.
3. **Given** yalnızca Google ile oluşturulmuş (parolasız) bir hesabın e-postası, **When** kullanıcı bu e-posta ile şifre sıfırlama isteği gönderir, **Then** sistem yine aynı genel mesajı gösterir ve hiçbir sıfırlama e-postası gönderilmez (Google-only hesap parola sıfırlama e-postası almaz).
4. **Given** kullanıcı e-posta alanına biçimsel olarak geçersiz bir değer girer, **When** isteği gönderir, **Then** sistem isteği işleme almadan anlaşılır bir doğrulama hatası gösterir (bu, e-posta biçim hatası olduğu için enumeration riski taşımaz).

---

### User Story 2 - Sıfırlama bağlantısıyla yeni şifre belirleme (Priority: P1)

Sıfırlama e-postasını alan kullanıcı, e-postadaki bağlantıya tıklayarak yeni bir şifre belirler. Bağlantı tek kullanımlıktır ve belirli bir süre sonra geçersiz hâle gelir.

**Why this priority**: Akışın tamamlanması için zorunludur; User Story 1 olmadan bu senaryo tek başına anlamlı değildir, ancak aynı MVP'nin ayrılmaz parçası olduğu için P1 olarak işaretlenmiştir.

**Independent Test**: Geçerli, süresi dolmamış bir sıfırlama token'ı ile doğrudan yeni-şifre-belirleme uç noktası çağrılarak (sıfırlama isteği akışından bağımsız olarak) test edilebilir; yeni şifre ile başarılı giriş yapılabildiği doğrulanarak değer teslim edilir.

**Acceptance Scenarios**:

1. **Given** geçerli ve süresi dolmamış bir sıfırlama bağlantısı, **When** kullanıcı politika ile uyumlu (en az 8 karakter, en az bir harf ve en az bir rakam) yeni bir şifre girip onaylar, **Then** sistem şifreyi günceller, kullanılan sıfırlama bağlantısını geçersiz kılar ve kullanıcıya işlemin başarılı olduğunu bildirir.
2. **Given** şifresi başarıyla sıfırlanmış bir kullanıcı, **When** kullanıcı yeni şifresiyle giriş yapmayı dener, **Then** giriş başarılı olur.
3. **Given** geçerli bir sıfırlama bağlantısı, **When** kullanıcı şifre politikasına uymayan bir şifre girer (örn. 6 karakter veya yalnızca harf), **Then** sistem işlemi reddeder ve politika gereksinimlerini açıklayan anlaşılır bir hata mesajı gösterir; bağlantı geçersiz kılınmaz (kullanıcı tekrar deneyebilir).

---

### User Story 3 - Geçersiz/süresi dolmuş/tekrar kullanılan bağlantı ile karşılaşma (Priority: P2)

Kullanıcı, artık geçerli olmayan bir sıfırlama bağlantısıyla (süresi dolmuş, daha önce kullanılmış veya hiç var olmamış bir token) yeni şifre belirlemeye çalışır.

**Why this priority**: Bu, güvenlik açısından önemli bir hata-yolu senaryosudur ancak User Story 1 ve 2'nin mutlu yolu çalışır durumdayken de bağımsız olarak doğrulanabilir; bu yüzden P2'dir.

**Independent Test**: Süresi geçmiş veya daha önce kullanılmış bir token ile yeni-şifre-belirleme uç noktası çağrılarak, isteğin reddedildiği ve kullanıcının yeni bir sıfırlama isteği başlatmaya yönlendirildiği doğrulanarak bağımsız test edilebilir.

**Acceptance Scenarios**:

1. **Given** süresi dolmuş bir sıfırlama bağlantısı, **When** kullanıcı bu bağlantı ile yeni şifre belirlemeye çalışır, **Then** sistem işlemi reddeder ve kullanıcıyı yeni bir sıfırlama isteği göndermeye yönlendiren anlaşılır bir mesaj gösterir.
2. **Given** daha önce başarıyla kullanılmış (tüketilmiş) bir sıfırlama bağlantısı, **When** kullanıcı aynı bağlantıyı tekrar açıp kullanmaya çalışır, **Then** sistem işlemi reddeder ve bağlantının artık geçerli olmadığını belirten bir mesaj gösterir.
3. **Given** rastgele üretilmiş veya hiç var olmamış bir token değeri, **When** bu değerle yeni-şifre-belirleme uç noktası çağrılır, **Then** sistem isteği reddeder ve token'ın var olup olmadığına dair ayrıntı sızdırmayan genel bir hata mesajı gösterir.

---

### Edge Cases

- Aynı kullanıcı art arda birden fazla sıfırlama isteği gönderirse ne olur? Sistem, tanımlı istek sıklığı sınırının üzerindeki istekleri engellemelidir (bkz. FR-007); ayrıca yeni bir istek gönderildiğinde önceki bekleyen sıfırlama bağlantı(lar)ının geçerliliği sona ermelidir, böylece yalnızca en güncel bağlantı kullanılabilir.
- Kullanıcı sıfırlama işlemini tamamladıktan sonra, işlem öncesinde açık kalmış diğer oturumlarına ne olur? Bkz. FR-008 — tüm diğer oturumlar sonlandırılır.
- Kullanıcı, sıfırlama sürecinin ortasındayken (bağlantıyı açtıktan sonra ama şifreyi onaylamadan önce) hesabı bir yönetici tarafından askıya alınır/silinirse ne olur? Sistem, işlemi tamamlamadan önce hesabın hâlâ aktif olduğunu doğrulamalı ve aksi durumda genel bir hata göstermelidir.
- Kullanıcı sıfırlama bağlantısını, gönderildiği tarayıcı/cihazdan farklı bir cihazda açarsa ne olur? Bağlantı yine geçerli kabul edilir (token cihaza bağlı değildir); bu durum ayrı bir güvenlik açığı oluşturmaz çünkü token zaten tek kullanımlık ve süreli e-posta erişimine dayanır.
- Aynı anda iki farklı sekmede aynı bağlantı üzerinden iki ayrı şifre gönderilirse ne olur? Sistem yalnızca ilk başarılı isteği kabul etmeli, ikincisini "bağlantı zaten kullanıldı" hatasıyla reddetmelidir (token tek kullanımlık olma özelliği bunu doğal olarak sağlar).
- Kullanıcı, hesabına ait olmayan ama sistemde kayıtlı bir e-posta ile başkası adına sıfırlama isteği gönderirse (kötüye kullanım denemesi) ne olur? İstek sıklığı sınırlaması (FR-007) ve genel yanıt biçimi (FR-002) bu tür kötüye kullanım denemelerinin etkisini sınırlar; gerçek hesap sahibine bağlantı gider ama saldırgan hesaba erişemez.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Sistem, kullanıcıların bir e-posta adresi girerek şifre sıfırlama isteği göndermesine izin VERMELİdir.
- **FR-002**: Sistem, girilen e-posta adresi sistemde kayıtlı olsun ya da olmasın, her istek için aynı genel bilgilendirme yanıtını (ör. "Eğer bu e-posta adresi sistemde kayıtlıysa bir sıfırlama bağlantısı gönderildi") göstermelidir; yanıt, hesabın var olup olmadığına dair hiçbir bilgi sızdırmamalıdır *(mevcut `001-auth-rol` FR-003/FR-014 enumeration-koruması mantığıyla tutarlı)*.
- **FR-003**: Sistem, yalnızca gerçek ve parola tabanlı (Google-only olmayan) bir hesaba ait e-posta adresi için arka planda bir sıfırlama e-postası göndermelidir; var olmayan e-postalar ve yalnızca Google ile oluşturulmuş hesaplar için hiçbir e-posta GÖNDERİLMEMELİdir.
- **FR-004**: Sistem, gönderilen sıfırlama bağlantısındaki token'ı tek kullanımlık ve süreli (sınırlı geçerlilik süresine sahip) olarak üretmelidir; token tahmin edilemeyecek kadar yüksek entropili, rastgele üretilmiş bir değer olmalıdır.
- **FR-005**: Sistem, bir sıfırlama token'ı başarıyla kullanıldıktan (şifre güncellendikten) hemen sonra o token'ı geçersiz kılmalı ve tekrar kullanılmasına İZİN VERMEMELİdir.
- **FR-006**: Sistem, yeni şifrenin mevcut şifre politikasına (en az 8 karakter, en az bir harf VE en az bir rakam) uygunluğunu doğrulamalıdır *(mevcut `001-auth-rol` FR-002 ile birebir aynı politika)*; uygun olmayan yeni şifreler anlaşılır bir hata mesajıyla reddedilmeli ve bu durumda token geçersiz kılınmamalıdır (kullanıcı aynı bağlantıyla tekrar deneyebilir).
- **FR-007**: Sistem, aynı e-posta adresi ve/veya kaynak için şifre sıfırlama isteklerinin sıklığını sınırlandırmalı (istek sıklığı sınırlaması / throttling) *(mevcut `001-auth-rol` FR-017 throttling mantığıyla tutarlı yaklaşım)*. Eşik: e-posta başına saatte en fazla 3 istek; aşım durumunda istek reddedilir (429).
- **FR-008**: Kullanıcı şifresini başarıyla sıfırladığında sistem, kullanıcının önceden var olan TÜM diğer aktif oturumlarını (mevcut sıfırlama akışı için kullanılan oturum hariç) SONLANDIRMALIdır (güvenlik önceliği: şifre değişimi sonrası eski oturumlar geçersiz olmalı).
- **FR-009**: Sistem, geçersiz, süresi dolmuş veya daha önce kullanılmış bir sıfırlama token'ı ile yapılan yeni-şifre-belirleme denemelerini reddetmeli ve token'ın hangi nedenle geçersiz olduğuna dair ayrıntı sızdırmayan (var olup olmadığını açığa çıkarmayan), kullanıcıyı yeni bir istek başlatmaya yönlendiren anlaşılır bir genel hata mesajı göstermelidir.
- **FR-010**: Sistem, sıfırlama bağlantısındaki token'ın geçerlilik süresini sınırlamalıdır. Süre: 1 saat.
- **FR-011**: Sistem, yeni bir şifre sıfırlama isteği gönderildiğinde, aynı kullanıcı için önceden üretilmiş ve henüz kullanılmamış sıfırlama token'larını geçersiz kılmalı; herhangi bir anda yalnızca en güncel token geçerli olmalıdır.
- **FR-012**: Sistem, şifre sıfırlama ile ilgili güvenlik açısından anlamlı olayları (istek oluşturma, başarılı sıfırlama, geçersiz/süresi dolmuş token denemesi, sıklık sınırı aşımı) kayıt altına almalıdır; sessiz başarısızlık (silent failure) yasaktır.
- **FR-013**: Sistem, sıfırlama bağlantısını yalnızca kullanıcının kendi e-posta adresine göndermelidir; bağlantı, e-posta içeriği dışında (ör. API yanıtında) hiçbir şekilde istemciye doğrudan ifşa EDİLMEMELİdir.

### Key Entities *(include if feature involves data)*

- **Şifre Sıfırlama Token'ı (Password Reset Token)**: Bir kullanıcı hesabıyla ilişkilendirilmiş, tek kullanımlık, rastgele üretilmiş ve süreli bir doğrulama değeri. Temel öznitelikleri: ilişkili kullanıcı, oluşturulma zamanı, son geçerlilik zamanı (expiresAt), kullanılma zamanı (usedAt/null). Yaşam döngüsü: oluşturulur → e-posta ile gönderilir → ya kullanılır (tek seferlik, sonra geçersiz) ya da süresi dolar ya da yeni bir istekle geçersiz kılınır.
- **Kullanıcı (User)**: Mevcut `001-auth-rol` slice'ından devralınan varlık; bu feature yalnızca kullanıcının kimlik doğrulama yöntemi (parola tabanlı vs. yalnızca Google) ve e-posta adresi bilgisine referans verir, yeni bir kullanıcı özniteliği eklemez.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Parola tabanlı ve geçerli bir hesap için gönderilen şifre sıfırlama isteklerinin tamamında, kullanıcı 2 dakika içinde sıfırlama e-postasını alır.
- **SC-002**: Kullanıcılar, e-postadaki bağlantıya tıkladıktan sonra yeni şifrelerini 1 dakikadan kısa sürede belirleyip onaylayabilir.
- **SC-003**: Var olmayan e-posta adresleri ve yalnızca-Google hesapları için gönderilen isteklerin %100'ünde sistem, gerçek/kayıtlı hesaplarla aynı genel yanıtı verir ve dışarıya ayırt edici hiçbir bilgi sızdırmaz (enumeration testleri geçer).
- **SC-004**: Süresi dolmuş veya daha önce kullanılmış sıfırlama bağlantılarının %100'ü ile yapılan şifre belirleme denemeleri reddedilir.
- **SC-005**: Tanımlanan istek sıklığı sınırının üzerindeki tekrarlayan sıfırlama istekleri, tanımlı sınır sonrasında tutarlı biçimde engellenir (rate-limit testleri geçer).
- **SC-006**: Yeni şifre belirleme sonrasında, kullanıcıların %100'ü yeni şifreleriyle ilk denemede başarılı giriş yapabilir.

## Assumptions

- Yeni şifre için geçerlilik politikası, mevcut kayıt/giriş akışındaki (`001-auth-rol` FR-002) şifre politikasıyla birebir aynıdır: en az 8 karakter, en az bir harf ve en az bir rakam.
- E-posta enumeration koruması, mevcut `001-auth-rol` spec'indeki FR-003 (mükerrer hesap engelleme) ve FR-014 (genel/ayırt edici olmayan hata mesajı) ile aynı tasarım deseni izlenerek uygulanır: sistem her zaman aynı genel yanıtı döner, yalnızca arka planda (e-posta gönderilip gönderilmeyeceği açısından) farklı davranır.
- İstek sıklığı sınırlaması (throttling): e-posta başına saatte en fazla 3 istek olarak netleştirilmiştir (FR-007); mevcut `001-auth-rol` FR-017'deki artan-gecikme yaklaşımından farklı, daha sıkı ve sabit bir eşiktir.
- Bu feature, mevcut kimlik doğrulama (auth) altyapısını ve kullanıcı/hesap modelini genişletir; yeni bir kullanıcı türü veya rol tanımlamaz.
- Bu spec, bilinçli olarak teknoloji veya sağlayıcı adı belirtmez (Anayasa İlke II); e-posta gönderim mekanizması ve token üretim/saklama yöntemi `/plan` aşamasında mimari kararlarla netleştirilecektir.
- Bu feature, `specs/001-auth-rol/tasks.md` T077 bulgusunda alınan "kapsam dışı bırak" kararının yerini alır (supersede); T077 artık bu spec'e yönlendirilmiştir.
- Google-only hesap sahiplerinin şifre belirlemesi bu spec'in kapsamı dışındadır; bu, mevcut hesabı parola tabanlı kimlik doğrulamaya "bağlama" (account linking) akışı olup ayrı bir feature konusudur.
