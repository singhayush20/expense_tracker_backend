import { Session } from '../entity/session.entity';
import { AuthenticatedUser } from '../dto/auth.dto';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      refreshToken?: string;
      session?: Session;
    }
  }
}

export {};
