// DOSYA REHBERİ: @Roles(...) ile etiketlenmiş rolü, giriş yapmış kullanıcının
// rolüyle karşılaştırır; uymuyorsa 403 döner. SessionGuard'dan SONRA çalışır
// çünkü request.user'a ihtiyaç duyar.
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthUser } from '../decorators/current-user.decorator';
// @Roles(...)  ile etiketlenmiş rolü, giriş yapmış kullanıcının rolüyle karşılaştırır; uymuyorsa 403 döner.  SessionGuard 'dan sonra çalışır çünkü  request.user 'a ihtiyaç duyar.
// R1 / contracts/authz-rules.md: request.user.role gerekli rolle karsilastirir;
// uymazsa 403 (FR-008). Metadata yoksa (Roles decorator kullanilmadiysa) izin verir.
// SessionGuard'dan SONRA calisir (request.user'a bagimli).
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    if (!request.user || !requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException();
    }

    return true;
  }
}
