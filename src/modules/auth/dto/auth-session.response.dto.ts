import { Role } from '../../user/enum/role.enum';

/**
 * User information returned in authentication responses
 */
export class AuthUserResponseDto {
  id!: string;

  /**
   * User email address (may be null for anonymous users)
   */
  email?: string | null;

  /**
   * User roles for authorization
   */
  roles!: Role[];
}
