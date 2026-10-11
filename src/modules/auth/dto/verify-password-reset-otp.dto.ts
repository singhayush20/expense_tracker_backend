import { IsEmail, IsString, Matches, Length } from 'class-validator';

export class VerifyPasswordResetOtpDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d+$/, { message: 'otp must contain only digits' })
  otp!: string;
}
