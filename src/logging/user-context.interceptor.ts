import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { PinoLogger } from 'nestjs-pino';

interface AuthenticatedRequest {
  user?: {
    id?: string;
  };
  id?: string;
}

@Injectable()
export class UserContextInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<AuthenticatedRequest>();

    /**
     * Authentication guards execute before interceptors.
     *
     * Therefore request.user should already be populated
     * by the time we reach this point.
     */
    const user = request.user;

    if (user?.id) {
      this.logger.assign({
        userId: user.id,
      });
    }

    return next.handle();
  }
}
