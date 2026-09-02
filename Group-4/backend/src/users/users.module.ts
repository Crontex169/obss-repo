// DOSYA REHBERİ: Kullanıcı hesap işlemleri özelliğini NestJS'e tanıtan
// montaj dosyası; auth ve veritabanı modüllerine bağlanır.
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PdfExtractionService } from '../pdf/pdf-extraction.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [UsersController],
  providers: [UsersService, PdfExtractionService],
})
export class UsersModule {}
