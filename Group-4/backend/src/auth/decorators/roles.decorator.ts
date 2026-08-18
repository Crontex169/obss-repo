// DOSYA REHBERİ: @Roles('admin') gibi süsleyiciyi tanımlar — bir route'un
// üstüne "buraya girmek için şu rol gerekir" etiketini yapıştırmanın yolu.
// Kendisi kontrol yapmaz, sadece metadata koyar; asıl kontrolü roles.guard.ts
// yapar.
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);