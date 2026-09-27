import { IsEmail, IsString, MaxLength } from 'class-validator';

export class EmailLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(128)
  password!: string;
}
