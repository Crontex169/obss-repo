// DOSYA REHBERİ: Kullanıcının kendi hesabıyla ilgili işlemlerin (KVKK onayı
// görme/verme, hesap silme) uç noktaları. Hedef kullanıcı her zaman
// oturumdan alınır, istek gövdesinden değil — böylece biri başkasının
// hesabını silmeye çalışamaz.
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { resolveUploadHardLimitBytes } from '../pdf/pdf-extraction.service';
import { SessionGuard } from '../auth/guards/session.guard';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  deleteAccountSchema,
  type DeleteAccountInput,
} from './dto/delete-account.dto';
import { UsersService } from './users.service';

type MulterFile = Express.Multer.File;

@Controller('api/users/me')
@UseGuards(SessionGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getMe(@Req() req: Request & { user?: AuthUser }) {
    return this.usersService.getKvkkConsent(req.user!.id);
  }

  // Kalici CV profili (multipart, tek PDF alani: `cvFile`). Sert boyut siniri
  // gorusme olusturmayla AYNI multer limitidir — iki uc noktada tek kural.
  @Post('cv')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('cvFile', {
      limits: { fileSize: resolveUploadHardLimitBytes() },
    }),
  )
  async uploadCv(
    @Req() req: Request & { user?: AuthUser },
    @UploadedFile() file: MulterFile | undefined,
  ) {
    if (!file) throw new BadRequestException('CV dosyasi yuklenmedi.');
    return this.usersService.saveCv(req.user!.id, file);
  }

  @Delete('cv')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCv(@Req() req: Request & { user?: AuthUser }): Promise<void> {
    await this.usersService.deleteCv(req.user!.id);
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
