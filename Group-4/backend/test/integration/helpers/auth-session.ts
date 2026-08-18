import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { PrismaService } from '../../../src/prisma/prisma.service';

// US1..US5 (002-interview) entegrasyon testleri icin paylasilan oturum yardimcisi.
// 001-auth-rol test dosyalarindaki (us5-ownership-guard.spec.ts) desenle AYNI:
// kayit ol -> e-postayi dogrulanmis isaretle -> giris yap -> cookie dondur.
export async function registerAndSignIn(
  app: INestApplication,
  prisma: PrismaService,
  email: string,
  role?: 'admin',
): Promise<string[]> {
  const password = 'Parola12';
  await request(app.getHttpServer())
    .post('/api/auth/sign-up/email')
    .send({ email, password, name: email });
  await prisma.user.update({
    where: { email },
    data: { emailVerified: true, ...(role ? { role } : {}) },
  });
  const signIn = await request(app.getHttpServer())
    .post('/api/auth/sign-in/email')
    .send({ email, password });
  return signIn.headers['set-cookie'] as unknown as string[];
}
