import { IsString, MinLength } from 'class-validator';

export class GoogleSignInDto {
  @IsString()
  @MinLength(1)
  idToken!: string;

  @IsString()
  deviceId?: string;

  @IsString()
  deviceName?: string;
}
