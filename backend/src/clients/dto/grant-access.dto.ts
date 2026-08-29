import { IsUUID } from 'class-validator';

export class GrantAccessDto {
  @IsUUID('4')
  userId: string;
}
