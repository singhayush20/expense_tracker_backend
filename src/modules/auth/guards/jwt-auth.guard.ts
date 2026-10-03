import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { UserStatus } from '../../user/enum';
import { AuthenticatedUser } from '../dto';
import { AuthenticatedRequest } from '../../../types/authenticated-request.type';
import { UserService } from '../../user/service/user.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthTokenService } from '../service/auth-token/auth-token.service';
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly usersService: UserService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

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
