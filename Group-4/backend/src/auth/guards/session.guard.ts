// DOSYA REHBERİ: "Bu isteği yapan giriş yapmış mı" sorusunun cevaplandığı ilk
// bekçi. Better Auth'tan oturumu doğrular, kullanıcıyı VERİTABANINDAN taze
// okuyup request.user'a yazar; oturum yoksa 401 döner.
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth.service';
import type { AuthUser } from '../decorators/current-user.decorator';
//"Bu isteği yapan giriş yapmış mı" sorusunun cevaplandığı ilk bekçi. Better Auth'tan oturumu doğrular,
//  kullanıcıyı veritabanından taze okuyup  request.user 'a yazar; oturum yoksa 401 döner.


// R5 / contracts/authz-rules.md: Better Auth oturumunu dogrular, request.user'i
// DB destekli oturumdan doldurur (istemciden gelen role guvenilmez). Oturum
// yok/gecersiz -> 401 (FR-013, SC-006).
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const session = await this.authService.getSession(request);

    if (!session?.user) {
      throw new UnauthorizedException();
    }

    request.user = {
      id: session.user.id,
      email: session.user.email,
      role: (session.user as { role?: string }).role ?? 'user',
    };

    return true;
  }
}
