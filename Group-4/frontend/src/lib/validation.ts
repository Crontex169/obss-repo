import { z } from 'zod'

// Istemci tarafi doğrulama yalnizca UX icindir; gercek doğrulama sunucu
// tarafindadir (Ilke V, FR-011). FR-002 ile birebir: min 8 karakter, en az
// bir harf + bir rakam.
export const emailSchema = z.string().email('Gecerli bir e-posta girin')
export const passwordSchema = z
  .string()
  .min(8, 'Sifre en az 8 karakter olmalidir')
  .regex(/[a-zA-Z]/, 'Sifre en az bir harf icermelidir')
  .regex(/[0-9]/, 'Sifre en az bir rakam icermelidir')

export function firstZodError(result: { success: boolean; error?: z.ZodError }): string | undefined {
  return result.success ? undefined : result.error?.issues[0]?.message
}
