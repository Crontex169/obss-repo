// DOSYA REHBERİ: Paylaşılan raporun ANONİM okuma ucu. Buradaki tek uç,
// oturum gerektirmeyen tek görüşme ucudur — kimlik yerine paylaşım token'ı
// yetkilendirir. Sahibin token üretme/iptal uçları interview.controller.ts'dedir.
import { Controller, Get, Param } from '@nestjs/common';
import { InterviewService } from './interview.service';

// SessionGuard BILEREK YOK: paylasilan linki acan kisinin hesabi olmaz.
// Yetkilendirme tek bir seye dayanir — token'i BILMEK (192 bit rastgelelik,
// bkz. interview.service.ts createShareLink). Bu yuzden:
//   - token bulunamadi / suresi doldu / gorusme silindi -> AYNI 404,
//   - donen govdede kullanicinin adi/e-postasi YOKTUR.
// Global hiz siniri (GlobalThrottleGuard) bu ucu de kapsar: token deneme
// (brute force) trafigi ayrica orada sinirlanir.
@Controller('api/shared-reports')
export class SharedReportController {
  constructor(private readonly interviewService: InterviewService) {}

  @Get(':token')
  findShared(@Param('token') token: string) {
    return this.interviewService.findSharedReport(token);
  }
}
