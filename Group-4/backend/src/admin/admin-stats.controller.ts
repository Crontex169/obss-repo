// DOSYA REHBERİ: /api/admin/stats tek uç noktasını karşılayan controller —
// istatistik dashboard'unun verisini döner. Aynı guard zinciri, aynı
// "salt-okunur" prensibi; tek metodu var (GET).
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/guards/session.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { statsQuerySchema, type StatsQuery } from './dto/stats-query.dto';
import { AdminService } from './admin.service';

// contracts/admin-api.md §3. SALT-OKUNUR: yalnizca @Get (FR-008, SC-005).
@Controller('api/admin/stats')
@Roles('admin')
@UseGuards(SessionGuard, RolesGuard)
export class AdminStatsController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  stats(@Query(new ZodValidationPipe(statsQuerySchema)) query: StatsQuery) {
    return this.adminService.getStats(query);
  }
}
