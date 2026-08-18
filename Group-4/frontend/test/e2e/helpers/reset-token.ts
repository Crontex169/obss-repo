import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { DATABASE_URL } from './backend-env'

const backendDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../backend',
)

// Sifirlama tokeni e-posta ile gider (MAIL_TRANSPORT=console/resend) — e2e onu
// posta kutusundan okuyamaz. Better Auth tokeni `verification` tablosunda
// `reset-password:<token>` kimligiyle saklar (better-auth/dist/api/routes/
// password.mjs:77), value = userId. Testte tokeni oradan okuyoruz: GERCEK
// sifirlama ucu calisiyor, yalnizca "e-posta teslimati" adimi atlaniyor
// (S1'deki signVerificationToken ile ayni yaklasim).
//
// Prisma istemcisi backend paketinde; script backend cwd'sinde ayri bir node
// sureci olarak kosar (frontend'e capraz-paket bagimlilik eklememek icin).
const SCRIPT = `
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
prisma.user
  .findUnique({ where: { email: process.argv[1] } })
  .then((user) =>
    prisma.verification.findFirst({
      where: { identifier: { startsWith: 'reset-password:' }, value: user.id },
      orderBy: { createdAt: 'desc' },
    }),
  )
  .then((v) => {
    if (!v) throw new Error('sifirlama tokeni bulunamadi')
    process.stdout.write(v.identifier.replace('reset-password:', ''))
    return prisma.$disconnect()
  })
`

export function readResetToken(email: string): string {
  return execFileSync(process.execPath, ['-e', SCRIPT, email], {
    cwd: backendDir,
    env: { ...process.env, DATABASE_URL },
    encoding: 'utf-8',
  }).trim()
}
