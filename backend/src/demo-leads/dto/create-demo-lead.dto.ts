import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateDemoLeadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name: string;

  @IsEmail()
  @MaxLength(255)
  email: string;
}
