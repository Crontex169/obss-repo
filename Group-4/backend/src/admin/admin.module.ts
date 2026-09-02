// DOSYA REHBERİ: Bu dikeyin "kayıt defteri". Hangi controller'ların, hangi
// service'in bu modüle ait olduğunu ve hangi dış modüllere (PrismaModule,
// AuthModule) ihtiyaç duyduğunu NestJS'e bildirir. Kendisi hiç iş mantığı
// içermez, sadece parçaları birbirine bağlar.
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { AdminInterviewsController } from './admin-interviews.controller';
import { AdminStatsController } from './admin-stats.controller';
import { AdminService } from './admin.service';

// 005-admin: salt-okunur admin paneli uc noktalari. 002-interview'in
// InterviewModule'une DOKUNMAZ; yalnizca PrismaService uzerinden okur.
// AuthModule, SessionGuard'in bagimli oldugu AuthService icin gerekli.
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminInterviewsController, AdminStatsController],
  providers: [AdminService],
})
export class AdminModule {}
/**
 * Bu dikeyin "kayıt defteri" — hangi controller'ların, hangi service'in bu modüle ait olduğunu ve hangi dış modüllere ( PrismaModule ,  AuthModule ) ihtiyaç duyduğunu NestJS'e bildirir. Kendisi hiç iş mantığı içermez, sadece parçaları birbirine bağlar.
 */
