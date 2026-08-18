// DOSYA REHBERİ: Uygulama açılırken veritabanına bağlanan, kapanırken
// bağlantıyı düzgünce kapatan servis. Prisma, veritabanına SQL yazmak yerine
// JavaScript/TypeScript fonksiyonlarıyla konuşmamızı sağlayan bir ORM
// (veritabanı çevirmeni) — bu dosya sadece onun bağlantı yaşam döngüsünü
// NestJS'e bağlıyor.
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// PrismaService: baglanti yasam donguyu NestJS modul sistemine baglar.
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
