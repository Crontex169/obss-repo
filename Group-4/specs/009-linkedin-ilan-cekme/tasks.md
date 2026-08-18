# Tasks: İlan bağlantısından otomatik iş ilanı çekme (#59)

**Kapsam**: Görüşme oluştururken metin/PDF'e ek olarak ilan bağlantısı yapıştırılabilir; sistem ilan metnini çeker ve mevcut soru üretimi akışına aynı şekilde besler.

**Neden bu dosya var**: Bu iş bir kez spec'siz denendi (dangling commit `66b8c90`) ve iki yerden kırıldı — (1) kullanıcının URL'si doğrudan `fetch`'e verilmişti, tek kontrol `url.includes('linkedin.com')` idi (**SSRF**), (2) DTO `linkedin_url` kabul ederken Prisma enum'ı güncellenmemişti, kayıt DB'ye yazılamıyordu.

Satır numaraları `17bab43` (main merge sonrası) itibarıyladır.

---

## 0. Doğrulanmış olgu

LinkedIn'in misafir ucu **oturum, çerez veya kimlik bilgisi istemez**:

```
https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/<jobId>
```

Yalnızca `user-agent` başlığıyla `200` döner. Gövdede ilan açıklaması `<div class="show-more-less-html__markup ...">` bloğunda gelir.

**Kanıt**: `4447384933` ID'si ile test edildi — `200`, temizlik sonrası **708 karakter** düz metin.

---

## 1. SSRF: doğrulamayla değil, tasarımla

Kullanıcının verdiği bağlantı **hiçbir zaman** `fetch`'e verilmez:

```
kullanıcı URL'si → regex → yalnızca sayısal ID → sabit LinkedIn adresi + ID → fetch
```

Hedefin tek değişken parçası `\d+`. Kullanıcı girdisi şemayı, host'u, portu veya yolu etkileyemez. Beyaz liste veya iç-IP filtresi **gerekmez** — hiçbiri bakım gerektirmeyecek kadar güvenilir değil.

Reddedilen tasarım: alan adı içerik araması + kullanıcı URL'sini doğrudan `fetch`. `http://169.254.169.254/latest/meta-data/?linkedin.com` bu kontrolü geçer ve sunucuyu bulut metadata servisine istek atmaya zorlar.

> **Bu tasarım değiştirilmez.**

---

## 2. Adımlar

### 2.1 `backend/src/interview/linkedin-job.ts` (YENİ)

```ts
const JOB_ID = /linkedin\.com\/jobs\/view\/(?:[^/]*-)?(\d+)/;

export async function fetchLinkedInJob(url: string): Promise<string> {
  const id = JOB_ID.exec(url)?.[1];
  if (!id) throw new Error('Gecerli bir LinkedIn is ilani URL\'si degil.');

  const res = await fetch(
    `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`,
    { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } },
  );
  if (!res.ok) throw new Error(`LinkedIn ilani okunamadi (HTTP ${res.status}).`);

  const html = await res.text();
  const markup = /<div class="show-more-less-html__markup[\s\S]*?<\/div>/.exec(html)?.[0];
  if (!markup) throw new Error('Ilan aciklamasi bulunamadi.');

  const text = markup
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<li[^>]*>/g, '- ')
    .replace(/<\/(p|li|ul|ol|div)>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (text.length < 50) throw new Error('Ilan aciklamasi cok kisa.');
  return text;
}
```

- [ ] Dosyayı yukarıdaki gibi ekle
- [ ] **Zaman aşımı ekle**: bu `fetch` süresiz bekler. `AbortSignal.timeout()` ile sınırla; hata diğerleri gibi 400'e çevrilsin.

`interview/` altında, `common/` altında değil: tek tüketicisi `interview.service.ts`. Kullanıcısı çoğalınca taşınır.

### 2.2 Veri tabanı — `backend/prisma/schema.prisma:96`

- [ ] `enum JobPostingSource`'a `url` ekle
- [ ] `npx prisma migrate dev --name job_posting_source_url`

Değer `url`, `linkedin_url` **değil**: enum DB'ye yazılıyor ve migration ile geliyor. Sağlayıcı adını şemaya gömmek, ikinci bir ilan sitesi eklendiğinde ya yanlış isimli değerle ya da ikinci bir migration ile yaşamak demek. Sağlayıcıya özgü kısım kodda kalır.

### 2.3 `backend/src/interview/dto/create-interview.dto.ts:8`

- [ ] `z.enum(['text','pdf'])` → `z.enum(['text','pdf','url'])`
- [ ] Yeni alan `jobPostingUrl: z.string().optional()`
- [ ] `superRefine`'e üçüncü dal: kaynak `url` ise `jobPostingUrl` zorunlu **ve** `JOB_ID` regex'ine uymalı → ağ isteği yapılmadan reddedilir

`JOB_ID` tek yerde tanımlanır (`linkedin-job.ts`), DTO oradan alır. İki kopya regex zamanla ayrışır.

### 2.4 `backend/src/interview/interview.service.ts:70-73`

Mevcut iki dallı ifade üçüncü dalı alır:

```ts
const jobPostingText =
  dto.jobPostingSource === 'pdf'
    ? await this.pdf.extractText(file!.buffer, file!.mimetype)
    : dto.jobPostingSource === 'url'
      ? await fetchLinkedInJob(dto.jobPostingUrl!)
      : dto.jobPostingText!.trim();
```

- [ ] `fetchLinkedInJob` hatasını **`BadRequestException`'a çevir**. Yakalanmazsa `HttpExceptionFilter` bunu 500 yapar ve kullanıcı akışta sıkışır.
- [ ] DB'ye `jobPostingSource: 'url'` + `jobPostingText: <çekilen metin>` yaz. **Bağlantının kendisi saklanmaz** — kayıtta metin zaten var, bağlantıyı da tutmak ikinci bir doğruluk kaynağı yaratır (bağlantı ölür, metin kalır) ve yeni sütun + migration maliyeti getirir.

### 2.5 Prompt injection — üç kaynak için birden

`jobPostingText` şu an **hiçbir kaynak türünde** `sanitizeFreeText()`'ten geçmiyor; yalnızca `wrapJobPostingAsData()` ile etiketleniyor, bu da sahte kapanış etiketini temizlemiyor. Aynı dosyada `sanitizeNullable` (`interview.service.ts:55-57`) bu yardımcıyı zaten kullanıyor.

- [ ] Düzeltmeyi yukarıdaki üçlü ifadenin **sonucuna** uygula, dal başına değil: tek satır, üç kaynağı da kapsar.

Mevcut açık, bağlantı özelliğinden bağımsız olarak zaten vardı; sadece yeni yola yama koymak aynı açığı iki yolda bırakır.

### 2.6 `backend/src/interview/interview.controller.ts:58`

- [ ] `pdf` dalındaki dosya zorunluluğu `url` kaynağını kapsamasın; `url` modunda dosya beklenmez. Mevcut multipart/JSON ikili desteği bozulmaz.
- [ ] **Doğrula**: `LlmRateLimitGuard` bu controller metoduna gerçekten uygulanmış mı? Guard katmanı servis gövdesinden önce çalışır — uygulanmışsa kota, dış istek yapılmadan devreye girer ve ek iş yok.

### 2.7 Frontend

- [ ] `frontend/src/lib/interview-client.ts:11` — kaynak tipi `'text' | 'pdf' | 'url'`, `jobPostingUrl` alanı
- [ ] `frontend/src/pages/interview/new.tsx:58` — üçüncü sekme + tek bağlantı girdisi. Mevcut metin/PDF sekmelerinin stili **birebir** kullanılır, yeni tasarım uydurulmaz.

---

## 3. Testler

**Yeni** — `backend/test/integration/us1-create-url.spec.ts`. `fetch` taklit edilir, kayıtlı HTML fixture kullanılır. **Gerçek ağa çıkılmaz.**

| Senaryo | Beklenen |
|---|---|
| Geçerli bağlantı + fixture | 201, görüşme oluşur, metin çekilmiş içerikten gelir |
| Bağlantı biçimi geçersiz | 400, **`fetch` hiç çağrılmaz** |
| Kaynak 404 döner | 400 |
| Açıklama bloğu bulunamaz | 400 |
| Metin 50 karakterden kısa | 400 |
| **SSRF**: `http://169.254.169.254/...?linkedin.com` | 400, **`fetch` hiç çağrılmaz** |

- [ ] SSRF testi önce yazılır, kırmızıdan yeşile geçtiği görülür
- [ ] `backend/test/integration/us1-*.spec.ts` tamamı **değişiklik gerektirmeden** geçer

> Testler `MAIL_TRANSPORT=console` ile koşulur — `.env`'deki gerçek mail sağlayıcısı entegrasyon testlerini FK hatasıyla kırar.

---

## 4. Kabul edilen sınırlar

- **JavaScript ile render edilen sayfalar kapsam dışı.** Sunucu-tarafı HTML okunur, tarayıcı motoru çalıştırılmaz. Playwright bu özelliğin maliyetini kat kat artırır. İçerik çıkarılamazsa kullanıcı metin/PDF yoluna yönlendirilir — özellik sessizce bozulmaz.
- **Yeniden deneme yok.** İlk başarısızlıkta hata döner. Retry, kullanıcı zaten beklerken gecikmeyi katlar. Ölçülen başarısızlık oranı yüksek çıkarsa eklenir.
- **Uç nokta sözleşmeye bağlı değil**, haber verilmeden değişebilir. Kabul edilmiş kırılganlık.

---

## 5. Bitti sayma ölçütü

- [ ] `npm test` + `npm run test:integration` (backend) yeşil — çıktı gösterilir
- [ ] `npm test` + `npm run build` (frontend) yeşil — çıktı gösterilir
- [ ] Migration uygulandı, mevcut `text`/`pdf` kayıtları etkilenmedi
- [ ] Metin ve PDF ile görüşme oluşturma elle bir kez denendi (regresyon)
