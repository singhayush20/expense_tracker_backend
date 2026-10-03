import { Role } from '../../user/enum/role.enum';

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  type: 'access';
  roles: Role[];
}

export interface AuthenticatedUser {
  id: string;
  sessionId: string;
  email: string | null | undefined;
  roles: Role[];
}

export interface RefreshTokenContext {
  userId: string;
  sessionId: string;
}
