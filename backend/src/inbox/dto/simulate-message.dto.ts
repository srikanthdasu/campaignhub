import { IsEnum, IsString, MinLength } from 'class-validator';
import { SocialPlatform } from '../../generated/prisma/client.js';

// "Simulate" because there's no real platform webhook wired up yet (needs the OAuth
// connections from Social Accounts & Integrations) — this is how the inbox gets test data
// until then, the same way Scheduler's "mark published" stands in for a real publish job.
export class SimulateMessageDto {
  @IsEnum(SocialPlatform)
  platform: SocialPlatform;

  @IsString()
  @MinLength(1)
  senderName: string;

  @IsString()
  @MinLength(1)
  message: string;
}
