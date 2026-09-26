import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Logger } from 'nestjs-pino';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();

    const request = context.getRequest<
      Request & {
        id?: string;
        user?: {
          id?: string;
        };
      }
    >();

    const response = context.getResponse<Response>();

    const isHttpException = exception instanceof HttpException;

    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const userId = request.user?.id;

    /**
     * Log the complete exception internally.
     *
     * Pino will serialize the Error including its stack.
     */
    this.logger.error(
      {
        err: exception,
        event: 'http.request.exception',
        requestId: request.id,
        userId,
        method: request.method,
        url: request.url,
        statusCode,
      },
      'Unhandled HTTP exception',
    );

    /**
     * Never expose internal implementation details.
     */
    const message =
      statusCode >= 500
        ? 'Internal server error'
        : this.getClientMessage(exception as HttpException);

    response.status(statusCode).json({
      statusCode,
      message,
      requestId: request.id,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private getClientMessage(exception: HttpException): string | string[] {
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return response;
    }

    if (
      typeof response === 'object' &&
      response !== null &&
      'message' in response
    ) {
      const message = (response as Record<string, unknown>).message;

      if (typeof message === 'string' || Array.isArray(message)) {
        return message;
      }
    }

    return exception.message;
  }
}
