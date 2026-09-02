// DOSYA REHBERİ: CSRF (siteler arası sahte istek) koruması. POST/PUT/PATCH/
// DELETE gibi durum değiştiren isteklerde Origin başlığının bilinen adresler
// listesinde (frontend/backend URL'i) olup olmadığını kontrol eder; uymuyorsa
// 403. Çerezin sameSite ayarı gevşetilse bile bu guard ayrı bir savunma
// katmanı sağlıyor.
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

//CSRF (siteler arası sahte istek) koruması. POST/PUT/PATCH/DELETE gibi durum değiştiren isteklerde
//  Origin  başlığının bilinen adresler listesinde (frontend/backend URL'i) olup olmadığını kontrol eder;
// uymuyorsa 403. Çerezin  sameSite  ayarı gevşetilse bile bu guard ayrı bir savunma katmanı sağlıyor.

// docs/SECURITY.md S5 — CSRF savunmasi.
//
// Better Auth kendi /api/auth/* rotalarini trustedOrigins ile korur. Ama
// /api/interviews, /api/pre-assessments, /api/users/me ve /api/admin/* NestJS
// tarafinda yazilmis, CEREZLE kimliklenen uclardir ve bunlarda hicbir origin
// kontrolu yoktu. Bugun somurulebilir degillerdi: Better Auth'un varsayilan
// sameSite=lax cerezi siteler arasi POST/DELETE'te gonderilmez. Sorun, bu
// korumanin kodda hicbir dayanaginin olmamasiydi — cerez sameSite='none'
// yapildigi an (ayri alan adina deploy bunu gerektirir) tum bu uclar CSRF'e
// acilir ve degisikligi yapanin bunu fark etmesi icin bir isaret yoktur.
//
// Bu guard o dayanagi kurar: state degistiren istekler icin Origin, izin
// verilen kumede olmak ZORUNDADIR. Boylece cerez duruşu gevsetilse bile
// savunma yerinde kalir.

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class OriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (!STATE_CHANGING.has(request.method)) return true;

    const origin = request.headers.origin;

    // Origin YOKSA gecilir. Tarayicilar siteler arasi state degistiren her
    // istekte (fetch ve form gonderimi dahil) Origin gonderir; basligin hic
    // olmamasi tarayici disi bir istemci demektir (curl, sunucu-sunucu, test
    // kosucusu) ve orada CSRF diye bir kavram yoktur. Basligi zorunlu kilmak
    // tarayici saldirisini engellemez, yalnizca tarayici olmayan mesru
    // istemcileri kirardi.
    if (!origin) return true;

    if (!isAllowed(origin)) {
      throw new ForbiddenException('Gecersiz origin.');
    }

    return true;
  }
}

function isAllowed(origin: string): boolean {
  const allowed = allowedOrigins();

  // Once HAM karsilastirma: tarayici Origin'i zaten normalize gonderir, bu
  // yuzden neredeyse her mesru istek burada eslesir ve hic URL ayristirilmaz.
  // normalize() yalnizca isabetsizlikte (nadir) devreye girer.
  if (allowed.has(origin)) return true;
  if (allowed.has(normalize(origin))) return true;

  // Tunel akisi ACIKKEN frontend de tunel origin'inden servis edilir
  // (bkz. better-auth.config.ts, ALLOW_TUNNEL_HOSTS). Bayrak kapaliyken bu dal
  // hic calismaz — yani uretim varsayilaninda joker origin YOKTUR.
  if (process.env.ALLOW_TUNNEL_HOSTS === 'true') {
    try {
      return new URL(origin).hostname.endsWith('.trycloudflare.com');
    } catch {
      return false;
    }
  }

  return false;
}

// Izin listesi ONBELLEKLENIR. Modul yukleme aninda dondurmak yanilticiydi
// (process.env testlerde ve tunel senaryosunda degisebiliyor), ama her istekte
// yeniden kurmak da bos yere Set ayirip URL ayristiriyordu — bu guard state
// degistiren HER istekte calisir. Anahtar, listeyi belirleyen iki env degeridir:
// degisirlerse onbellek kendiliginden tazelenir, degismezlerse hic is yapilmaz.
let cachedKey: string | undefined;
let cachedOrigins: Set<string> = new Set();

function allowedOrigins(): Set<string> {
  const frontend = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  // Tek-origin topolojide istekler backend'in kendi adresinden gelir.
  const backend = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';
  const key = `${frontend}\n${backend}`;

  if (key !== cachedKey) {
    cachedOrigins = new Set([normalize(frontend), normalize(backend)]);
    cachedKey = key;
  }

  return cachedOrigins;
}

function normalize(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}
