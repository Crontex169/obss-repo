// DOSYA REHBERİ: Tek işi var — gelen isteğin başlıklarından (headers) oturumu
// Better Auth'a sorup sonucu döndürmek. SessionGuard her istekte oturumun
// geçerli olup olmadığını buradan öğrenir.
import { Inject, Injectable } from '@nestjs/common';
import { BETTER_AUTH, type BetterAuthInstance } from './better-auth.config';
import type { Request } from 'express';
//Tek işi var: gelen isteğin başlıklarından (headers) oturumu Better Auth'a sorup sonucu döndürmek.
//   SessionGuard  her istekte oturumun geçerli olup olmadığını buradan öğrenir.
// Oturum/kullanıcı yardımcıları (guard'larca kullanılır).
@Injectable()
export class AuthService {
  constructor(@Inject(BETTER_AUTH) private readonly auth: BetterAuthInstance) {}

  async getSession(req: Request) {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers.set(key, value);
      else if (Array.isArray(value)) headers.set(key, value.join(', '));
    }
    return this.auth.api.getSession({ headers });
  }
}
