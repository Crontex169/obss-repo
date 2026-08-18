import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(dirname, '../../../../backend/.env')

// Playwright bu dosyalari ayri bir Node sureci olarak calistirir; backend'in
// .env'ini paylasmiyor. Yalnizca ihtiyac duyulan degerler duz metinden okunur
// (backend'e capraz-paket bagimlilik/dotenv eklemek yerine).
function readEnvValue(key: string): string {
  const content = readFileSync(envPath, 'utf-8')
  const match = new RegExp(`^${key}="?([^"\n\r]*)"?$`, 'm').exec(content)
  if (!match) {
    throw new Error(`${key}, backend/.env icinde bulunamadi (e2e test icin gerekli)`)
  }
  return match[1]
}

export const BETTER_AUTH_SECRET = readEnvValue('BETTER_AUTH_SECRET')
export const ADMIN_EMAIL = readEnvValue('ADMIN_EMAIL')
export const ADMIN_PASSWORD = readEnvValue('ADMIN_PASSWORD')
export const DATABASE_URL = readEnvValue('DATABASE_URL')
