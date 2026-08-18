// DOSYA REHBERİ: "Bu görüşme gerçekten senin mi?" kontrolünü yapan bekçi —
// oturumdaki kullanıcı, URL'deki görüşme kaydının sahibi değilse isteği
// reddeder (403 yerine 404 döner ki başkasının kaydının var olduğu bile
// anlaşılmasın).
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../../auth/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

// 001-auth-rol OwnershipGuard sozlesmesini Interview kaynagina baglar (FR-017).
//
// Fark ve GEREKCESI: auth dilimindeki OwnershipGuard route param ":ownerId"
// karsilastirir ve 403 doner. Interview'da sahip kimligi route'ta DEGIL, kaydin
// kendisindedir; ayrica docs/API_CONVENTIONS.md 1 "yabanci kayit -> 404" kuralini
// kapatmistir: 403 kaydin VAR OLDUGUNU sizdirir ve id deneyerek baskasinin kayit
// sayisi cikarilabilir. Bu yuzden burada 404 kullanilir ve "yok" ile AYIRT
// EDILEMEZ olmalidir (ayni kod, ayni govde, ayni mesaj).
//
// SessionGuard'dan SONRA calisir (request.user'a bagimli).
@Injectable()
export class InterviewOwnershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const user = request.user;
    if (!user) throw new NotFoundException();

    const id = request.params?.id;
    if (!id || typeof id !== 'string') throw new NotFoundException();

    const interview = await this.prisma.interview.findUnique({
      where: { id },
      select: { userId: true, deletedAt: true },
    });

    const isAdmin = user.role === 'admin';

    // Admin okuma erisimi (authz-rules.md R3): silinmis kayitlari da gorur (4.3).
    if (isAdmin) {
      if (!interview) throw new NotFoundException();
      // Admin salt okunurdur — baskasinin kaydina YAZAMAZ (1).
      if (!isReadRequest(request) && interview.userId !== user.id) {
        throw new ForbiddenException();
      }
      return true;
    }

    // Sahip icin soft-delete gorunmezdir: "silinmis" ile "yok" ayni yaniti verir.
    if (!interview || interview.userId !== user.id || interview.deletedAt) {
      throw new NotFoundException();
    }

    return true;
  }
}

function isReadRequest(request: Request): boolean {
  return request.method === 'GET' || request.method === 'HEAD';
}
