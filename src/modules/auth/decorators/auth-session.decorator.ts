import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Session } from '../entity';
import { SessionRequest } from '../../../types/authenticated-request.type';

export const AuthSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Session | undefined => {
    const request = ctx.switchToHttp().getRequest<SessionRequest>();
    return request.authSession;
  },
);
