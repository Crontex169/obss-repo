# Sözlü Mod STT: Groq Whisper — Tasarım

- **Tarih:** 2026-08-24
- **Durum:** Onaylandı (kullanıcı, brainstorming diyaloğu)
- **İlişkili:** ADR-0010 (kısmen değiştirilecek), yeni ADR-0014 açılacak

## Bağlam

ADR-0010 (2026-07-30), sözlü modun STT (`SpeechRecognition`) ve TTS
(`SpeechSynthesis`) ikisini de tarayıcı Web Speech API ile çözdüğüne karar
vermişti — sunucu tarafında ses işleme yok, sıfır maliyet, ikinci sağlayıcı
yok. Gerekçe kayıtlı riski (R2) şuydu: "Türkçe transkript hataları — kullanıcı
gönderim öncesi metni görüp düzeltebilir."

Bu tasarım o riski R2'nin öngördüğü mitigasyonla değil, kaynağında çözüyor:
**STT tarafı** tarayıcıdan alınıp Groq Whisper'a taşınıyor. **TTS aynen
kalıyor** — bu bir tam geri alma değil, kısmi bir değiştirme.

## Motivasyon

Türkçe transkript kalitesi. Tarayıcı desteği (Firefox/Safari) motivasyon
DEĞİL — yan fayda olarak geliyor (MediaRecorder+getUserMedia, SpeechRecognition'dan
daha geniş desteklenir) ama tasarım kararlarını bu yönde zorlamıyoruz.

## Kapsam dışı (kasıtlı)

- **TTS değişmiyor.** `speak`/`stopSpeaking`/`speech-queue.ts`/`speech-segment.ts`
  hiç dokunulmuyor.
- **Kalıcı maliyet/süre kaydı yok.** Kota guard'ı kötüye kullanımı zaten
  engelliyor; admin panelinde görünürlük istenirse ayrı bir iş.
- **Canlı (akan) transkript yok.** Whisper toplu çalışır: kayıt biter, tek
  seferde gönderilir, metin ancak o zaman gelir. Konuşurken yalnızca kayıt
  göstergesi (ses seviyesi) görünür.
- **Otomatik motor değişimi (Whisper başarısız → tarayıcı STT'sine sessiz
  geçiş) yok.** Başarısızlıkta yazılı moda düşülür, hata gösterilir.
- **İkinci STT sağlayıcısı / model seçimi yok.** Yalnızca Groq
  `whisper-large-v3-turbo` (ücretsiz katman, aynı liste-fiyatı-raporlama
  deseni LLM'de zaten var — ADR-0007).

## Kararlar (brainstorming diyaloğunda onaylandı)

| Soru | Karar |
|---|---|
| Whisper kaynağı | Groq (LLM ile aynı ekosistem, ücretsiz katman) |
| TTS | Değişmiyor, tarayıcıda kalıyor |
| Motivasyon | Türkçe transkript kalitesi |
| Canlı önizleme | Yok — yalnızca kayıt göstergesi, metin toplu gelir |
| Otomatik durdurma | Ses seviyesi analizi (Web Audio `AnalyserNode`), mevcut `VOICE_SILENCE_TIMEOUT_MS` eşiği aynen kullanılır |
| Hata durumu | Yazılıya düş + hata göster; otomatik yeniden deneme yok |
| Kota | Ayrı saatlik kova (`stt`), LLM kotasından bağımsız, aynı Redis deposu (S1) |

## Mimari

### Backend — yeni

```
backend/src/transcription/
  transcription.module.ts
  transcription.controller.ts   # POST /api/interviews/:id/transcribe
  transcription.service.ts      # Groq /openai/v1/audio/transcriptions çağrısı
```

- **Uç nokta:** `POST /api/interviews/:id/transcribe`, multipart, alan adı
  `audio`. Guard sırası: `SessionGuard` (sınıf-seviyesi, mevcut) →
  `InterviewOwnershipGuard` (mevcut) → yeni `SttRateLimitGuard`.
- **Groq çağrısı:** `model: 'whisper-large-v3-turbo'`, `language: <Interview.language>`
  (`tr`/`en` — TTS'in zaten kullandığı alan), `response_format: 'json'`.
  Dönüş: `{ text: string }`.
- **Env:** yeni `GROQ_API_KEY` (opsiyonel, `LLM_API_KEY`'den BAĞIMSIZ —
  `LLM_PROVIDER=deepseek` olsa bile Whisper hep Groq'tan gelir). Boşsa
  istek servis katmanında hata döner; frontend bunu normal sağlayıcı
  hatasıymış gibi işler (aşağıda) — ayrı bir "yapılandırılmamış" durumu
  YOK, tek hata yolu yeterli.
- **Kota:** `common/guards/stt-rate-limit.guard.ts` — `llm-rate-limit.guard.ts`
  ile **birebir aynı desen**, ayrı kova adı `stt`. `app.module.ts`'teki
  `ThrottlerModule.forRootAsync` listesine üçüncü kova eklenir. S1'de
  kurulan Redis deposu (`REDIS_URL`) buraya da otomatik uygulanır — yeni
  altyapı gerekmez. Varsayılan limit: **30/saat** (yargısal başlangıç
  değeri, `sttQuota(n)` ile uç nokta bazında değiştirilebilir — mevcut
  `llmQuota(n)` deseni).
- **429/hata biçimi:** mevcut `throttle-response.ts` (`Retry-After` +
  `[ratelimit]` telemetri satırı) aynen kullanılır, kova adı `stt` olarak
  loglanır.

### Frontend — değişen

- **`voice-client.ts`:** `startDictation` (SpeechRecognition tabanlı)
  kaldırılır, yerine yeni bir kayıt fonksiyonu gelir:
  `getUserMedia({audio:true})` + `MediaRecorder` ile ses kaydı,
  `AnalyserNode` ile ses seviyesi izlenir. Sessizlik `VOICE_SILENCE_TIMEOUT_MS`
  kadar sürerse kayıt otomatik durur, blob backend'e yüklenir.
  `voiceSupport().recognition` artık `SpeechRecognition` yerine
  `MediaRecorder`+`getUserMedia` varlığını kontrol eder.
- **`voice-controls.tsx`:** faz makinesine `'transcribing'` eklenir
  (`'idle' → 'speaking' → 'listening' → 'transcribing' → 'reviewing'`).
  `'listening'` fazında canlı metin (`interim`) yerine kayıt/ses seviyesi
  göstergesi gösterilir. `'transcribing'` fazında yükleniyor durumu.
  Transkript dönünce mevcut `onFinal` akışına (`onChange` ile cevaba ekleme)
  aynen girer — bu davranış DEĞİŞMİYOR.
- **`interview-client.ts`:** yeni yardımcı, `transcribeAudio(interviewId, blob)`
  — multipart POST, transkript metnini döner.
- **Hata akışı:** mikrofon izni reddi → aynı (`onFallbackToWritten`, mevcut
  davranış). Whisper çağrısı başarısız (ağ/429/5xx/yapılandırılmamış) → hata
  mesajı gösterilir + yazılıya düşülür, otomatik yeniden deneme yok — aynı
  desen mikrofon izni reddiyle.

### Karar kaydı (ADR)

- Yeni **ADR-0014** açılır: "Sözlü Mod STT: Groq Whisper". Alternatifler
  tablosu (tarayıcı STT / Groq Whisper / diğer sağlayıcı), gerekçe (Türkçe
  kalite), riskler (Groq ücretsiz katman kota tavanı — ADR-0007'deki TPM
  riskiyle aynı desen) içerir.
- **ADR-0010** durumu `⛔ Kısmen değiştirildi (STT → 0014, TTS aynen kalır)`
  olarak güncellenir. Var olan metin SİLİNMEZ — repo konvansiyonu (bkz.
  ADR-0006 → 0007) kararların üzerine yazılmaz, yenisi eskiyi işaretler.
- `docs/DECISIONS.md` başındaki ADR tablosuna yeni satır.
- `docs/TECH_STACK.md` "Voice / Speech" satırı güncellenir: "STT: Groq
  Whisper (whisper-large-v3-turbo) · TTS: Web Speech API (tarayıcı)".

## Test planı

- **Backend (yeni):** `transcription.service.spec.ts` — sahte Groq
  istemcisiyle başarı/hata yolları. `stt-rate-limit.spec.ts` —
  `llm-rate-limit.spec.ts` deseninin kopyası, `stt` kovasıyla.
  Entegrasyon: `POST /api/interviews/:id/transcribe` sahte sağlayıcıyla
  201/429/502 yolları (mevcut `interview-app.ts` test altyapısı genişletilir).
- **Frontend (yeniden yazılır):** `voice-client.test.ts` — `MediaRecorder`/
  `getUserMedia` sahteleriyle kayıt+yükleme akışı. `voice-controls.test.tsx`
  — yeni `'transcribing'` fazı, hata/fallback yolları.
- **Değişmeyen:** `speech-queue.test.ts`, `speech-segment.test.ts` (TTS,
  dokunulmadı).

## Riskler ve azaltma

| # | Risk | Azaltma |
|---|------|---------|
| R1 | Groq Whisper ücretsiz katman kota tavanı (ADR-0007 TPM riskiyle aynı desen) | `stt` kovası + Redis paylaşımlı sayaç (S1) ilk savunma katmanı; sağlayıcı 429 dönerse kullanıcı yazılıya düşer |
| R2 | Mikrofon izni / `MediaRecorder` desteği yok | `voiceSupport()` kontrolü aynen kalıyor — desteklenmiyorsa sözlü mod UI'da devre dışı (FR-025, sessiz başarısızlık yok) |
| R3 | `GROQ_API_KEY` yapılandırılmamış ortamda sözlü mod her denemede hata verir | Kabul edilen davranış — ayrı bir "yapılandırılmamış" durumu eklenmedi (YAGNI); tek hata yolu her iki durumu da kapsıyor |

## Ertelenen (bu spec kapsamında değil)

- Kalıcı transkripsiyon maliyet/süre kaydı (admin panelinde görünürlük).
- Parçalı (chunk) gönderimle canlı transkript.
- Whisper başarısız olunca tarayıcı STT'sine otomatik geçiş.
