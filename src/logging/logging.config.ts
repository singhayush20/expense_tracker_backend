import { randomUUID } from 'node:crypto';
import type { Params } from 'nestjs-pino';

export function createLoggerConfig(): Params {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    pinoHttp: {
      level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),

      /**
       * Correlation ID for every HTTP request.
       *
       * If the client/load balancer already provides an
       * X-Request-ID, preserve it. Otherwise generate one.
       */
      genReqId: (req) => {
        const requestId = req.headers['x-request-id'];

        if (typeof requestId === 'string' && requestId.length > 0) {
          return requestId;
        }

        return randomUUID();
      },

      /**
       * Fields automatically added to every HTTP log.
       */
      customProps: (req) => ({
        service: process.env.SERVICE_NAME ?? 'expense-tracker-api',
        environment: process.env.NODE_ENV ?? 'development',
        version: process.env.APP_VERSION ?? 'unknown',
        requestId: req.id,
      }),

      /**
       * Never allow secrets to appear in logs.
       */
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

      /**
       * Keep HTTP logs useful without dumping complete
       * request/response objects.
       */
      serializers: {
        req: (req) => ({
          method: req.method,
          url: req.url,
          userAgent: req.headers['user-agent'],
          remoteAddress: req.remoteAddress,
        }),

        res: (res) => ({
          statusCode: res.statusCode,
        }),
      },

      /**
       * Health endpoints can generate huge amounts of noise
       * in production because infrastructure may call them
       * every few seconds.
       */
      autoLogging: {
        ignore: (req) => {
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
