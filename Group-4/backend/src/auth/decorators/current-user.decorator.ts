// DOSYA REHBERİ: Oturum açmış kullanıcının request üzerindeki şeklini (AuthUser)
// tanımlar. SessionGuard request.user'ı bu tiple doldurur; controller'lar ve
// ownership guard'ları da aynı tipi kullanarak req.user'ı okur.

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}
