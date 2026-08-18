// DOSYA REHBERİ: Kullanıcının kendi hesabıyla ilgili işlemlerin (KVKK onayı
// görme/verme, hesap silme) uç noktaları. Hedef kullanıcı her zaman
// oturumdan alınır, istek gövdesinden değil — böylece biri başkasının
// hesabını silmeye çalışamaz.
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from '../auth/guards/session.guard';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  deleteAccountSchema,
  type DeleteAccountInput,
} from './dto/delete-account.dto';
import { UsersService } from './users.service';

@Controller('api/users/me')
@UseGuards(SessionGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getMe(@Req() req: Request & { user?: AuthUser }) {
    return this.usersService.getKvkkConsent(req.user!.id);
  }

  @Post('kvkk-consent')
  setKvkkConsent(@Req() req: Request & { user?: AuthUser }) {
    return this.usersService.setKvkkConsent(req.user!.id);
  }

  // Hesap silme (KVKK unutulma hakki). Yalnizca oturum sahibinin KENDI hesabi;
  // hedef kullanici govdeden DEGIL oturumdan alinir, boylece baskasinin
  // hesabini silmeye calismak mumkun degildir.
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMe(
    @Req() req: Request & { user?: AuthUser },
    @Body(new ZodValidationPipe(deleteAccountSchema)) dto: DeleteAccountInput,
  ): Promise<void> {
    await this.usersService.deleteAccount(req.user!.id, dto);
  }
}
