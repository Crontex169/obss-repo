// DOSYA REHBERİ: Tüm uç noktalarda geçerli, IP başına kaba bir emniyet freni
// (300 istek/60 sn gibi). ThrottlerGuard'ın standart hâlini değil özel bir
// versiyonunu kullanır çünkü aksi hâlde bu guard, LLM uç noktalarındaki
// kullanıcı-bazlı kotayı da yanlışlıkla IP-bazlı uygulardı — burada bilerek
// yalnızca "default" kovaya bakıyor, LLM kovasına karışmıyor.
import { Injectable, type ExecutionContext } from '@nestjs/common';
import {
  ThrottlerGuard,
  type ThrottlerLimitDetail,
  type ThrottlerRequest,
} from '@nestjs/throttler';
import { logThrottled, setRetryAfter } from './throttle-response';

//Tüm uç noktalarda geçerli, IP başına kaba bir emniyet freni (300 istek/60 sn gibi).
//  ThrottlerGuard 'ın standart hâlini değil özel bir versiyonunu kullanır çünkü aksi hâlde bu guard,
// LLM uç noktalarındaki kullanıcı-bazlı kotayı da yanlışlıkla IP-bazlı uygulardı —
// burada bilerek yalnızca "default" kovaya bakıyor, LLM kovasına karışmıyor.d

// docs/SECURITY.md S3 — tum rotalarda gecerli, IP basina kaba emniyet freni.
// app.module.ts'te APP_GUARD olarak kayitlidir.
//
// NEDEN duz ThrottlerGuard DEGIL: ThrottlerGuard.canActivate yapilandirilmis
// TUM kovalari gezer ve her biri icin rotadaki @Throttle metadata'sini okur.
// Duz hâliyle global guard, LLM uc noktalarindaki @Throttle(llmQuota(3))
// degerini de gorur ve onu KENDI izleyicisiyle (IP) uygular. Sonuc iki katli
// hataliydi: (1) global guard rota guard'indan ONCE calistigi icin 429'u o
// atiyordu ve LlmRateLimitGuard'in `details.retryAfterSeconds` tasiyan
// govdesi hic uretilmiyordu; (2) kullanici basina olmasi gereken LLM kotasi
// fiilen IP basina donuyordu — ayni NAT arkasindaki iki kullanici birbirinin
// kotasini tuketirdi.
//
// Bu yuzden global guard YALNIZCA `default` kovasindan sorumludur; isimli
// kovalar (llm) kendi guard'larina birakilir.
@Injectable()
export class GlobalThrottleGuard extends ThrottlerGuard {
  protected async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    if (requestProps.throttler.name !== 'default') {
      return true; // bu kova baska bir guard'in sorumlulugunda
    }
    return super.handleRequest(requestProps);
  }

  // Retry-After (2026-08-21): emniyet freni 429'u da `Retry-After` tasir. Govde kutuphanenin
  // varsayilani olarak kalir (bu kova kullaniciya degil kotuye kullanima
  // bakar); degisen yalnizca istemcinin ne zaman tekrar deneyecegini
  // standart yerden okuyabilmesidir.

  protected async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    setRetryAfter(context, detail.timeToBlockExpire);
    logThrottled(context, 'default', detail.limit, detail.timeToBlockExpire);
    return super.throwThrottlingException(context, detail);
  }
}
