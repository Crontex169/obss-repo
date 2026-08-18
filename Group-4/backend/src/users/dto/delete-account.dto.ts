// DOSYA REHBERİ: Hesap silme isteğinin gövdesini doğrulayan Zod şeması.
// Parolalı hesapta parola, sadece-Google hesapta "onaylıyorum" işareti
// istenir — hangisinin gerektiğine istemci değil sunucu karar verir (aksi
// hâlde kontrol atlatılabilirdi).
import { z } from 'zod';

// DELETE /api/users/me govdesi. Iki onay yolu vardir ve HANGISININ gecerli
// oldugunu SUNUCU belirler (Ilke V — istemci kontrolu atlatilabilir):
//   - Parolali hesap (account.providerId = 'credential') -> `password` zorunlu,
//     hash ile dogrulanir.
//   - Yalnizca-Google hesap -> dogrulanacak parola YOKTUR, `confirm: true`
//     zorunlu (kullanici acikca "geri alinamaz" onayini isaretler).
// Her iki alan da opsiyonel yazilir; hangisinin arandigi servis tarafinda
// hesabin gercek durumuna gore secilir.
export const deleteAccountSchema = z.object({
  password: z.string().min(1).optional(),
  confirm: z.boolean().optional(),
});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
