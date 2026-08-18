// DOSYA REHBERİ: Veritabanı bağlantısını (PrismaService) uygulamanın her
// yerinden erişilebilir yapan montaj dosyası (@Global()). Böylece her
// modülün ayrı ayrı import etmesine gerek kalmaz.
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
