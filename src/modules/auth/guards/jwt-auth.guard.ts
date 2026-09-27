import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { Request } from 'express';
import { AuthenticatedUser } from '../dto/auth.dto';
import { AuthTokenService } from '../service/auth-token/auth-token.service';
import { UserStatus } from '../../user/enum/user-status.enum';
import { UserService } from '../../user/service/user.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly usersService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    const payload = await this.authTokenService.verifyAccessToken(token);

    const user = await this.usersService.findById(payload.sub);

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User account is not active');
    }

    const roles = await this.usersService.getUserRoles(user.id);

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      sessionId: payload.sid,
      email: user.email,
      roles,
    };

    request.user = authenticatedUser;

    return true;
  }

  private extractBearerToken(request: Request): string | null {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return null;
    }

    const [scheme, token] = authorization.split(' ');

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return null;
    }

    return token;
  }
}
