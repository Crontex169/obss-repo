// DOSYA REHBERİ: Aylık plan kotası. Kullanıcının içinde bulunduğu takvim ayında
// oluşturduğu görüşme sayısını planının limitiyle karşılaştırır; aşımda 402
// (Payment Required) atar.
//
// SAATLİK hız sınırından (llm-rate-limit.guard.ts) AYRI bir katmandır ve onun
// yerine GEÇMEZ:
//   - saatlik sınır  -> kötüye kullanım savunması -> 429 "yavaşla"
//   - plan kotası    -> ticari kısıt              -> 402 "planını yükselt"
// İkisi birlikte çalışır; istemci iki durumu karıştırmamalıdır (FR-007).
//
// Guard YALNIZCA yeni görüşme oluşturan uç noktaya bağlanır. Var olan bir
// görüşmeye cevap vermek / rapor üretmek kota TÜKETMEZ (FR-004) — bunun için
// ayrı bir kural yazılmaz, guard'ın oraya bağlanmaması yeterlidir.
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import {
  currentMonthStartUtc,
  monthlyQuotaFor,
  resolvePlan,
} from '../../billing/plan';
import type { AuthUser } from '../../auth/decorators/current-user.decorator';

@Injectable()
export class PlanQuotaGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const userId = req.user!.id;

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { planTier: true, proUntil: true },
    });
    const plan = resolvePlan(user);
    const limit = monthlyQuotaFor(plan);

    // `deletedAt` FILTRESI BILEREK YOK: silinen gorusme de sayilir. Filtre
    // konsaydi "olustur -> sil -> olustur" sinirsiz kota olurdu, oysa soru
    // uretiminin LLM maliyeti olusturma aninda zaten harcanmistir (FR-005).
    // Bunu koruyan test: test/integration/us1-quota-counts-deleted.spec.ts
    //
    // ponytail: transaction yok — es zamanli iki istek ikisi de limit-1 sayip
    // gecebilir, yani limit en fazla BIR gorusme asilir. Kabul edilen tavan;
    // onemli hale gelirse sayimi SERIALIZABLE transaction'a al.
    const used = await this.prisma.interview.count({
      where: { userId, createdAt: { gte: currentMonthStartUtc() } },
    });

    if (used >= limit) {
      throw new HttpException(
        {
          message:
            'Bu ayki gorusme hakkiniz doldu. Devam etmek icin planinizi yukseltin.',
          // Zarf sozlesmesi (docs/API_CONVENTIONS.md 2, http-exception.filter.ts):
          // ek alanlar `details` altinda tasinir, gövde koküne serpilmez.
          details: { plan, used, limit },
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return true;
  }
}
