// DOSYA REHBERİ: /api/admin/interviews uç noktalarını karşılayan controller —
// liste (GET) ve tek görüşme detayı (GET /:id). Guard zinciri SessionGuard ->
// RolesGuard('admin') ile korunur; sahiplik kontrolü yok çünkü admin her kaydı
// okuyabilmeli. Kritik: bu dosyada @Post/@Patch/@Delete hiç yok — bilinçli bir
// tasarım, admin panelinin yazma yetkisi olmadığının garantisi (yanlışlıkla
// eklenirse bile route eşleşmediği için 404 döner).
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../auth/guards/session.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  listInterviewsQuerySchema,
  type ListInterviewsQuery,
} from './dto/list-interviews-query.dto';
import { AdminService } from './admin.service';

// contracts/admin-api.md §1-§2. SALT-OKUNUR: bu dosyada @Post/@Patch/@Put/
// @Delete dekoratoru KULLANILMAZ (FR-008, SC-005) — yazma istegi route
// eslesmedigi icin 404 alir, garanti route'un hic var olmamasidir.
//
// Guard zinciri: SessionGuard (401) -> RolesGuard('admin') (403).
// Sahiplik kontrolu YOK — admin her kaydi okuyabilir (authz-rules.md R3).
@Controller('api/admin/interviews')
@Roles('admin')
@UseGuards(SessionGuard, RolesGuard)
export class AdminInterviewsController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(listInterviewsQuerySchema))
    query: ListInterviewsQuery,
  ) {
    return this.adminService.listInterviews(query);
  }

  // "Bildir" (interview-card) kayitlarinin salt-okunur listesi. Literal path
  // olduğu icin :id route'undan ONCE tanimlanir (Nest sirali eslestirir).
  @Get('problem-reports')
  listProblemReports() {
    return this.adminService.listProblemReports();
  }

  // §2: silinmis kayit da EKSIKSIZ doner; yalnizca "gercekten yok" 404'tur
  // (admin her kayda mesru erisime sahip oldugundan varlik gizliligi gecmez).
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const detail = await this.adminService.getInterviewDetail(id);
    if (!detail) throw new NotFoundException();
    return detail;
  }
}
