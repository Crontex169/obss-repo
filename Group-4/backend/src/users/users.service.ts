// DOSYA REHBERİ: KVKK onayını kaydetme/okuma ve hesap silme işlemlerinin
// gerçek mantığı; hesap silme öncesi parola doğrulaması veya onay kontrolünü
// burada yapar, ayrıca başarısız silme denemelerini hız sınırlamasına tabi
// tutar.
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyPassword } from 'better-auth/crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  checkAccountDeleteRateLimit,
  recordFailedAccountDeleteAttempt,
} from '../auth/rate-limit.config';
import type { DeleteAccountInput } from './dto/delete-account.dto';

// KVKK onayi: dashboard ilk girişte popup gösterilir, kabul edildiğinde
// tek seferlik olarak işaretlenir (kvkkConsentAt null ise hiç onaylanmamış demektir).
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getKvkkConsent(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { kvkkConsentAt: true },
    });
    // hasPassword: hesap silme onayinin hangi bicimde alinacagini belirler
    // (parola girisi mi, yalnizca onay kutusu mu). Yalnizca-Google hesapta
    // dogrulanacak parola yoktur. Bu bilgi tek basina hassas degildir; parola
    // ya da hash'i ASLA istemciye gitmez.
    const credential = await this.prisma.account.findFirst({
      where: { userId, providerId: 'credential', NOT: { password: null } },
      select: { id: true },
    });
    return {
      kvkkConsentAt: user.kvkkConsentAt,
      hasPassword: credential !== null,
    };
  }

  async setKvkkConsent(userId: string) {
    const existing = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { kvkkConsentAt: true },
    });
    // Idempotent: zaten onaylanmışsa ilk onay tarihi korunur, ezilmez.
    if (existing.kvkkConsentAt) return existing;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { kvkkConsentAt: new Date() },
      select: { kvkkConsentAt: true },
    });
    return { kvkkConsentAt: user.kvkkConsentAt };
  }

  // KVKK "unutulma hakki": kullanicinin rizasini geri cekmesi. Karar, soft-delete
  // DEGIL tam silmedir — kisisel veri (ad/e-posta) veritabaninda hic kalmaz.
  // Iliskili her kayit sema seviyesindeki onDelete: Cascade ile birlikte duser:
  // session, account (Google baglantisi dahil), Interview -> Question/Answer/
  // Report, PreAssessment -> CompetencyReport ve TokenUsage. Bu, admin
  // istatistiklerinin o kullaniciya ait gecmisini de kaybetmesi demektir;
  // bilincli takas.
  //
  // Tum kurallar SUNUCUDA uygulanir (Ilke V): istemciyi atlayip dogrudan
  // istek atmak ayni kontrollerden gecer.
  async deleteAccount(userId: string, dto: DeleteAccountInput): Promise<void> {
    // docs/SECURITY.md S2: parola dogrulamasi ONCESI siklik kontrolu. Sinir
    // kullanici basinadir; hedef zaten oturumdan geldigi icin e-posta degil
    // userId anahtarlanir. Kontrol, hesabin parolali olup olmadigina BAKMADAN
    // once calisir - aksi halde "parola isteniyor mu" bilgisi yanit
    // zamanlamasindan cikarilabilirdi.
    const { blocked, retryAfterSeconds } = checkAccountDeleteRateLimit(userId);
    if (blocked) {
      throw new HttpException(
        {
          message:
            'Çok fazla başarısız deneme. Lütfen daha sonra tekrar deneyin.',
          details: { retryAfterSeconds },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        role: true,
        accounts: { select: { providerId: true, password: true } },
      },
    });

    // Kapsam: yalnizca 'user' rolu. Admin kendi hesabini silemez — aksi halde
    // sistem yonetimsiz kalabilirdi.
    if (user.role === 'admin') {
      throw new ForbiddenException('Yönetici hesapları bu uçtan silinemez.');
    }

    const credential = user.accounts.find(
      (account) => account.providerId === 'credential' && account.password,
    );

    if (credential) {
      if (!dto.password) {
        throw new BadRequestException('Onay için şifrenizi girin.');
      }
      const valid = await verifyPassword({
        hash: credential.password!,
        password: dto.password,
      });
      if (!valid) {
        // Sayac YALNIZCA gercek bir tahmin basarisiz oldugunda artar; eksik
        // govde (400) bir tahmin degildir ve kotayi tuketmemelidir.
        recordFailedAccountDeleteAttempt(userId);
        throw new UnauthorizedException('Şifre hatalı.');
      }
    } else if (dto.confirm !== true) {
      // Yalnizca-Google hesap: dogrulanacak parola yok, acik onay sart.
      throw new BadRequestException('Silme işlemini onaylamanız gerekiyor.');
    }

    await this.prisma.user.delete({ where: { id: userId } });
  }
}
