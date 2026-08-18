// DOSYA REHBERİ: supertest yanıtından `Set-Cookie` başlığını DİZİ olarak okur.
//
// NEDEN: `@types/superagent` `headers`'ı `{ [k: string]: string }` olarak
// tipliyor, oysa Node `set-cookie`'yi HER ZAMAN dizi döndürür (tek çerezde bile).
// Tip yanlış, çalışma zamanı doğru. Bu yardımcı o yanlışlığı TEK yerde kapatır;
// aksi halde her entegrasyon testinde ayrı bir cast yazılması gerekirdi.
import type { Response } from 'supertest';

export function setCookiesOf(res: Response): string[] {
  return (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
}
