import { IsEnum } from 'class-validator';
import { ClientGroupRole } from '../../generated/prisma/client.js';

export class UpdateAccessRoleDto {
  @IsEnum(ClientGroupRole)
  role: ClientGroupRole;
}
