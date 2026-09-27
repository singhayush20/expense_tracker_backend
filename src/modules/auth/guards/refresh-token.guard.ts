import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { Request } from 'express';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { SessionService } from '../service/session/session.service';

type RefreshTokenRequest = Request<
  Record<string, string>,
  unknown,
  Partial<RefreshTokenDto>
>;

@Injectable()
export class RefreshTokenGuard implements CanActivate {
  constructor(private readonly sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RefreshTokenRequest>();

    const refreshToken = this.extractRefreshToken(request);

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token required');
    }

    const session =
      await this.sessionService.findValidSessionByRefreshToken(refreshToken);

    request.refreshToken = refreshToken;
    request.session = session;

    return true;
  }

  private extractRefreshToken(request: RefreshTokenRequest): string | null {
    const token = request.body?.refreshToken;

    if (typeof token !== 'string' || token.length === 0) {
      return null;
    }

    return token;
  }
}
