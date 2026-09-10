import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ClientGroupRole } from '../../generated/prisma/client.js';

export class GrantAccessDto {
  @IsUUID('4')
  userId: string;

  @IsOptional()
  @IsEnum(ClientGroupRole)
  role?: ClientGroupRole;
}
