const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export interface ApiErrorBody {
  statusCode: number
  error: string
  message: string
  details?: Record<string, unknown>
}

export class ApiError extends Error {
  status: number
  body: ApiErrorBody

  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.status = status
    this.body = body
  }
}

async function parse<T>(res: Response): Promise<T> {
  const body = await res.json()
  if (!res.ok) throw new ApiError(res.status, body as ApiErrorBody)
  return body as T
}

export interface KvkkConsentStatus {
  kvkkConsentAt: string | null
}

export interface CvProfile {
  fileName: string | null
  updatedAt: string | null
}

export interface AccountStatus extends KvkkConsentStatus {
  // Hesabin parolasi var mi (Google ile giren kullanicida yoktur). Hesap silme
  // onayinin bicimini belirler: parola girisi mi, yalnizca onay kutusu mu.
  hasPassword: boolean
  // Kayitli CV profili — yoksa null. CV METNI istemciye HIC gelmez, yalnizca
  // "var mi + hangi dosyadan + ne zaman" (sunucu tarafi veri asgarisi).
  cv: CvProfile | null
}

// §GET — KVKK onay durumu (dashboard mount'unda tek seferlik popup icin) ve
// hesabin parola durumu (Ayarlar'daki hesap silme onayi icin).
export async function getKvkkConsentStatus(): Promise<AccountStatus> {
  const res = await fetch(`${API_URL}/api/users/me`, { credentials: 'include' })
  return parse<AccountStatus>(res)
}

// §POST — idempotent, ilk onaydan sonraki cagrilar mevcut tarihi degistirmez.
export async function acceptKvkkConsent(): Promise<KvkkConsentStatus> {
  const res = await fetch(`${API_URL}/api/users/me/kvkk-consent`, {
    method: 'POST',
    credentials: 'include',
  })
  return parse<KvkkConsentStatus>(res)
}

// §DELETE — hesabi kalici olarak siler (KVKK unutulma hakki). Onay bicimini
// SUNUCU secer: parolali hesapta `password`, yalnizca-Google hesapta
// `confirm: true` beklenir. 204 doner, govde yoktur.
export async function deleteAccount(payload: {
  password?: string
  confirm?: boolean
}): Promise<void> {
  const res = await fetch(`${API_URL}/api/users/me`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new ApiError(res.status, (await res.json()) as ApiErrorBody)
  }
}

// §POST /api/users/me/cv — kalici CV profili (tek PDF). Ayni uc hem ilk
// yuklemeyi hem degistirmeyi yapar: kayit uzerine yazilir.
export async function uploadCv(file: File): Promise<CvProfile> {
  const form = new FormData()
  form.set('cvFile', file)
  const res = await fetch(`${API_URL}/api/users/me/cv`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  })
  return parse<CvProfile>(res)
}

// §DELETE /api/users/me/cv — 204, govde yok. Idempotent.
export async function deleteCv(): Promise<void> {
  const res = await fetch(`${API_URL}/api/users/me/cv`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) {
    throw new ApiError(res.status, (await res.json()) as ApiErrorBody)
  }
}
