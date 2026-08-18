import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

// FR-018: ADMIN_EMAIL/ADMIN_PASSWORD env'den seed edilir. Idempotent: e-posta
// zaten varsa yeniden olusturmaz (mukerrer User/Account yaratmaz).
export async function seedAdmin(prisma: PrismaClient): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'ADMIN_EMAIL ve ADMIN_PASSWORD ortam degiskenleri zorunludur',
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`[seed] Admin zaten mevcut (${email}), atlaniyor.`);
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      role: 'admin',
      emailVerified: true,
      name: 'Admin',
    },
  });
  await prisma.account.create({
    data: {
      userId: user.id,
      providerId: 'credential',
      accountId: user.id,
      password: passwordHash,
    },
  });
  console.log(`[seed] Admin olusturuldu (${email}).`);
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedAdmin(prisma)
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
