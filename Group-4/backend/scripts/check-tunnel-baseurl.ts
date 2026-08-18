// Cloudflare quick tunnel opsiyonelligini dogrular: baseURL dinamik cozulur,
// tunel Host'u gelince tunel adresi, gelmeyince local fallback doner. Yani tunel
// acmak/kapatmak .env degisikligi ve backend restart gerektirmez.
//
// Calistir: npx ts-node scripts/check-tunnel-baseurl.ts
// Jest'te kosmuyor: better-auth ESM-only, buradaki jest kurulumu CJS.
import assert from 'node:assert/strict';
import { resolveBaseURL } from 'better-auth';
import type { PrismaClient } from '@prisma/client';
import { createAuth } from '../src/auth/better-auth.config';

// Gercek uygulama config'i okunur; literal kopyalanmaz.
const config = createAuth({} as PrismaClient).options.baseURL;

const coz = (host: string) =>
  resolveBaseURL(config, '/api/auth', new Headers({ host }), undefined, true);

assert.equal(
  coz('ability-qualities-mix-uses.trycloudflare.com'),
  'https://ability-qualities-mix-uses.trycloudflare.com/api/auth',
  'tunel Host tunel adresini cozmeli',
);

// Kontrol grubu: tunel kapaliyken local davranis degismemeli.
assert.equal(
  coz('localhost:5173'),
  'http://localhost:3000/api/auth',
  'local Host fallback donmeli',
);

// Kontrol grubu: listede olmayan host tunel adresi uretmemeli.
assert.equal(
  coz('evil.com'),
  'http://localhost:3000/api/auth',
  'bilinmeyen host fallback donmeli',
);

console.log('OK: tunel acikken tunel adresi, kapaliyken localhost:3000');
