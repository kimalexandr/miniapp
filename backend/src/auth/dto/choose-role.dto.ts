import { IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

export class ChooseRoleDto {
  @IsEnum(UserRole, { message: 'Роль должна быть CLIENT или DRIVER' })
  role: UserRole;
}
