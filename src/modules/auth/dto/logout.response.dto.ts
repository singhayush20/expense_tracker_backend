import { IsBoolean } from 'class-validator';

/**
 * Response DTO for logout operation
 */
export class LogoutResponseDto {
  @IsBoolean()
  success!: boolean;
}
