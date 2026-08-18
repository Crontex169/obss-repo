// DOSYA REHBERİ: Admin guard zincirinin gerçekten çalıştığını kanıtlayan basit
// bir "yoklama" uç noktası (GET /api/admin/ping) — gerçek admin panel uç
// noktaları admin/ modülünde ayrıca yazıldı.
import { Controller, Get, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../guards/session.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

// FR-008: admin paneli yalniz admin rolune acik. Gercek admin panel
// uc noktalari sonraki dilimlerde eklenecek; bu, guard zincirinin gercek
// (test-only olmayan) bir route'ta calistigini kanitlayan ornek uc nokta.
@Controller('api/admin')
export class AdminController {
  @Roles('admin')
  @UseGuards(SessionGuard, RolesGuard)
  @Get('ping')
  ping() {
    return { ok: true };
  }
}
