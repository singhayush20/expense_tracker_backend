import { Role } from '../../user/enum/role.enum';

/**
 * Response DTO for successful authentication (login/register)
 *
 * Contains tokens and user information needed for client session initialization
 */
export class LoginResponseDto {
  /**
   * JWT access token for API authentication
   */
  accessToken!: string;

  /**
   * Refresh token for obtaining new access tokens
   */
  refreshToken!: string;

  /**
   * Access token expiration time in seconds
   */
  expiresIn!: number;

  /**
   * Authenticated user information
   */
  user!: {
    id: string;
    roles: Role[];
  };
}
