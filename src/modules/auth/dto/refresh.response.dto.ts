import { Role } from '../../user/enum/role.enum';

/**
 * Response DTO for token refresh operation
 *
 * Returns new tokens and updated user information
 */
export class RefreshResponseDto {
  /**
   * New JWT access token
   */
  accessToken!: string;

  /**
   * New refresh token (rotation)
   */
  refreshToken!: string;

  /**
   * Access token expiration time in seconds
   */
  expiresIn!: number;

  /**
   * Current user information
   */
  user!: {
    id: string;
    email: string | null;
    roles: Role[];
  };
}
