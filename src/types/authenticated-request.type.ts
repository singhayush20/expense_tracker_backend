import { Request } from 'express';
import { AuthenticatedUser } from '../modules/auth/dto/auth.dto';
import { RefreshTokenDto } from '../modules/auth/dto/refresh-token.dto';
import { Session } from '../modules/auth/entity/session.entity';

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

export type SessionRequest = Request & {
  authSession?: Session;
  refreshToken?: string;
};

export type RefreshTokenRequest = Request<
  Record<string, string>,
  unknown,
  Partial<RefreshTokenDto>
> & {
  authSession?: Session;
  refreshToken?: string;
};
