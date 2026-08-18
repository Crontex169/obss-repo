// 007-ui-design v2.pen "Password Strength Popup": parola alanina odaklanildiginda
// alanin USTUNDE acilan bilgi kutusu.
//
// Onemli ayrim: bu bir GUC GOSTERGESIDIR, kayit sarti degil. Zorunlu politika
// sunucuda ve lib/validation.ts'te tanimli (min 8 + harf + rakam, FR-002);
// buyuk/kucuk harf ve sembol maddeleri yalnizca kullaniciyi daha guclu bir
// parolaya tesvik eder. Ikisini birlestirip formu bloklamak, sunucunun kabul
// ettigi bir parolayi istemcide reddetmek olurdu.
//
// 5 kural x %20 = %100. Sembol kurali listede GOSTERILMEZ: kullaniciya "iyi"
// esigini (%80) sembolsuz de gecebilecegini soyler, %100'u ise kesfedilecek
// bir ek olarak birakir.
const KURALLAR = [
  { etiket: 'En az 8 harf', test: (s: string) => s.length >= 8 },
  { etiket: 'En az 1 rakam', test: (s: string) => /[0-9]/.test(s) },
  { etiket: 'En az 1 büyük harf', test: (s: string) => /[A-ZÇĞİÖŞÜ]/.test(s) },
  { etiket: 'En az 1 küçük harf', test: (s: string) => /[a-zçğıöşü]/.test(s) },
  // Gizli 5. kural. Harf/rakam OLMAYAN her sey sembol sayilir; `\p{L}` sayesinde
  // Turkce harfler (ç, ğ, ş...) yanlislikla sembol olarak islenmez.
  { etiket: null, test: (s: string) => /[^\p{L}\p{N}]/u.test(s) },
]

// %80 ve uzeri "kabul edilir" sayilir (4/5 kural) — sembol olmadan da erisilir.
const IYI_ESIK = 80

export function PasswordStrength({ value }: { value: string }) {
  const gecen = KURALLAR.filter((k) => k.test(value))
  const yuzde = gecen.length * 20
  const renk =
    yuzde >= IYI_ESIK
      ? 'var(--color-success)'
      : yuzde >= 40
        ? 'var(--color-warning)'
        : 'var(--color-danger)'

  return (
    <div className="absolute bottom-full left-0 z-10 mb-2 flex w-full flex-col gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-3.5 shadow-[0_4px_16px_rgba(0,0,0,0.15)]">
      <p className="text-[13px] font-semibold text-[var(--color-text)]">
        Parola Güvenlik Seviyesi: %{yuzde}
      </p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${yuzde}%`, backgroundColor: renk }}
        />
      </div>
      <p className="text-xs font-semibold text-[var(--color-text)]">
        Parola Gereklilikleri:
      </p>
      <ul className="flex flex-col gap-1.5">
        {KURALLAR.filter((k) => k.etiket).map((kural) => {
          const tamam = kural.test(value)
          return (
            <li
              key={kural.etiket}
              className="text-xs"
              style={{
                color: tamam ? 'var(--color-success)' : 'var(--color-text)',
              }}
            >
              {kural.etiket}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
