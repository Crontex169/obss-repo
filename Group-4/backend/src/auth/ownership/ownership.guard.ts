// DOSYA REHBERİ: Genel amaçlı "bu kaydın sahibi gerçekten bu kullanıcı mı"
// kontrolü — URL'deki :ownerId ile giriş yapmış kullanıcıyı karşılaştırır,
// admin ise geçirir. (Görüşme dikeyi kendi özel versiyonunu kullanıyor, bu
// dosya daha genel/temel bir örnek.)
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../decorators/current-user.decorator';

//Genel amaçlı "bu kaydın sahibi gerçekten bu kullanıcı mı" kontrolü — URL'deki  :ownerId  ile giriş yapmış kullanıcıyı karşılaştırır, admin ise geçirir.

// R2/R3 / contracts/authz-rules.md: kaynak sahibi route param ":ownerId" ile
// request.user.id karsilastirilir; admin okuma icin baypas edilir. Sahiplik
// yoksa 403 (icerik sizdirilmaz, SC-003). Bu dilimde korunan gercek kaynak
// (gorusme/rapor) henuz yok — sozlesme burada kurulur, sonraki dilimler kendi
// route'larinda ":ownerId" param adiyla bu guard'a baglanir (kullanici onayi).
// SessionGuard'dan SONRA calisir (request.user'a bagimli).
@Injectable()
export class OwnershipGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const ownerId = request.params?.ownerId;

    if (!request.user) {
      // contracts/authz-rules.md: oturum yok/gecersiz -> 401 (403 degil, bulgu A3)
      throw new UnauthorizedException();
    }

    if (request.user.role === 'admin') {
      return true;
    }

    if (ownerId !== request.user.id) {
      throw new ForbiddenException();
    }

    return true;
  }
}
