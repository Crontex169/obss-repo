// DOSYA REHBERİ: Auth dikeyinin kayıt defteri — hangi controller/guard/service'in
// bu modüle ait olduğunu ve Better Auth örneğinin nasıl oluşturulup (BETTER_AUTH
// token'ı ile) diğer modüllere export edildiğini tanımlar.
import { Module } from '@nestjs/common';
import { BetterAuthController } from './better-auth.controller';
import { AuthService } from './auth.service';
import { SessionGuard } from './guards/session.guard';
import { RolesGuard } from './guards/roles.guard';
import { OwnershipGuard } from './ownership/ownership.guard';
import { AdminController } from './admin/admin.controller';
import { PrismaService } from '../prisma/prisma.service';
import { BETTER_AUTH, createAuth } from './better-auth.config';
// Bu dikeyin kayıt defteri — hangi controller/guard/service'in 
// bu modüle ait olduğunu ve  Better Auth  örneğinin nasıl oluşturulup ( BETTER_AUTH  token'ı ile) diğer modüllere  export  edildiğini tanımlar.
@Module({
  controllers: [BetterAuthController, AdminController],
  providers: [
    {
      provide: BETTER_AUTH,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => createAuth(prisma),
    },
    AuthService,
    SessionGuard,
    RolesGuard,
    OwnershipGuard,
  ],
  exports: [BETTER_AUTH, AuthService, SessionGuard, RolesGuard, OwnershipGuard],
})
export class AuthModule {}
