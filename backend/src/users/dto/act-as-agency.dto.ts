import { IsString, IsUUID } from 'class-validator';

export class ActAsAgencyDto {
  @IsUUID()
  agencyId: string;

  // Step-up auth (AUTH-3): a SUPER_ADMIN session token alone shouldn't be enough to drop into any
  // agency on the platform — re-proving the password matches the same bar changePassword()
  // already holds another sensitive account action to.
  @IsString()
  currentPassword: string;
}
