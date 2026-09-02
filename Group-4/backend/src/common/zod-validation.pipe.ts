// DOSYA REHBERİ: Gelen istek gövdesini/query'yi bir Zod şemasıyla doğrulayan
// genel amaçlı pipe. Proje zaten Zod'u her yerde kullandığı için (env, LLM
// şemaları) ikinci bir doğrulama kütüphanesi (class-validator) eklenmemiş;
// şema uymazsa hata HttpExceptionFilter'a düşüp ortak formata çevrilir.
import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

// Gelen istek gövdesini/query'yi bir Zod şemasıyla doğrulayan genel amaçlı pipe. Proje zaten Zod'u
// her yerde kullandığı için (env, LLM şemaları) ikinci bir doğrulama kütüphanesi ( class-validator ) eklenmemiş;
// şema uymazsa hata  HttpExceptionFilter 'a düşüp ortak formata çevrilir.

// Genel Zod dogrulama pipe'i — proje zaten Zod'u her yerde kullaniyor (env, LLM
// semalari); ikinci bir dogrulama kutuphanesi (class-validator) GEREKMEZ.
// Hata mesaji BadRequestException'a duser -> global HttpExceptionFilter ortak
// zarfa (statusCode/error/message) cevirir.
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: z.ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(result.error.issues[0]?.message);
    }
    return result.data;
  }
}
