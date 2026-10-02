import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../dto/auth.dto';
import { AuthenticatedRequest } from '../../../types/authenticated-request.type';

export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const user = request.user;

    if (!field) {
      return user;
    }

    return user?.[field];
  },
);
