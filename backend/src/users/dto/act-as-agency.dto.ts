import { IsUUID } from 'class-validator';

export class ActAsAgencyDto {
  @IsUUID()
  agencyId: string;
}
