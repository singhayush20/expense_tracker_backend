import { randomUUID } from 'node:crypto';
import type { Params } from 'nestjs-pino';
import type { IncomingMessage, ServerResponse } from 'http';

type RequestWithId = IncomingMessage & {
  id?: string | number;
  headers: Record<string, string | string[] | undefined>;
};

export function createLoggerConfig(): Params {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    pinoHttp: {
      level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),

      /**
       * Correlation ID for every HTTP request.
       *
       * If the client/load balancer already provides an
       * X-Request-ID, preserve it. Otherwise generate one
       * and set it as a response header.
       */
      genReqId: (req: IncomingMessage, res: ServerResponse) => {
        const requestId = (req as RequestWithId).headers['x-request-id'];

        if (typeof requestId === 'string' && requestId.length > 0) {
          return requestId;
        }

        const id = randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      customLogLevel: (
        req: IncomingMessage,
        res: ServerResponse,
        err?: Error,
      ) => {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';
        if (res.statusCode >= 300) return 'silent';
        return 'info';
      },
      customProps: () => ({
        service: process.env.SERVICE_NAME ?? 'expense-tracker-api',
        environment: process.env.ENV ?? 'unknown',
        version: process.env.APP_VERSION ?? 'unknown',
      }),
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',

          'req.body.password',
          'req.body.currentPassword',
          'req.body.newPassword',

          'req.body.accessToken',
          'req.body.refreshToken',

          'res.headers["set-cookie"]',
        ],
        censor: '[REDACTED]',
      },
      serializers: {
        req: (req: IncomingMessage) => {
          const typedReq = req as RequestWithId & {
            method?: string;
            url?: string;
            remoteAddress?: string;
          };
          return {
            method: typedReq.method,
            url: typedReq.url,
            userAgent: typedReq.headers['user-agent'],
            remoteAddress: typedReq.remoteAddress,
          };
        },

        res: (res: ServerResponse) => ({
          statusCode: res.statusCode,
        }),
      },

      /**
       * Health endpoints can generate huge amounts of noise
       * in production because infrastructure may call them
       * every few seconds.
       */
      autoLogging: {
        ignore: (req: IncomingMessage) => {
          return (
            req.url === '/health' ||
            req.url === '/health/live' ||
            req.url === '/health/ready' ||
            req.url === '/metrics'
          );
        },
      },
      ...(isProduction
        ? {}
        : {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                singleLine: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname,req.headers,req.remoteAddress',
              },
            },
          }),
    },
  };
}
