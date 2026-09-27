import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { HttpStatus, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationError } from 'class-validator';
import express from 'express';
import { AppException } from './exceptionn-handling/app-exception';
import { ExceptionCodes } from './exceptionn-handling/exception-codes';
import { DataSource } from 'typeorm';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  /**
   * Replace Nest's default logger with Pino.
   */
  app.useLogger(app.get(Logger));

  const logger = app.get(Logger);
  const dataSource = app.get(DataSource);
  const configService = app.get(ConfigService);

  try {
    await dataSource.initialize();
    const host = configService.get<string>('database.host');
    const port = configService.get<number>('database.port');
    const database = configService.get<string>('database.name');
    logger.log(`Database connected: ${host}:${port}/${database}`);
  } catch (error) {
    logger.error(`Database connection failed: ${(error as Error).message}`);
    process.exit(1);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      stopAtFirstError: false,
      disableErrorMessages:
        app.get(ConfigService).get<string>('env') === 'production',
      exceptionFactory: (errors: ValidationError[]) => {
        const extractMessages = (
          validationErrors: ValidationError[],
          depth = 0,
        ): string[] => {
          const messages: string[] = [];
          const indent = '  '.repeat(depth);

          for (const err of validationErrors) {
            if (err.constraints) {
              const constraintMessages = Object.values(err.constraints);
              messages.push(
                ...constraintMessages.map((msg: string) => `${indent}${msg}`),
              );
            }
            if (err.children && Array.isArray(err.children)) {
              messages.push(
                ...extractMessages(err.children, depth + 1).map(
                  (msg: string) => `${indent}${msg}`,
                ),
              );
            }
          }
          return messages;
        };

        const messageList = extractMessages(errors);
        const message =
          messageList.length > 0 ? messageList.join('; ') : 'Validation failed';

        return new AppException(
          ExceptionCodes.METHOD_ARGUMENT_NOT_VALID,
          message,
          HttpStatus.BAD_REQUEST,
        );
      },
    }),
  );

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  const config = new DocumentBuilder()
    .setTitle('CodeSense')
    .setDescription('AI Code Reviewer Platform')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);

  const swaggerUser = configService.get<string>('swagger.username');
  const swaggerPassword = configService.get<string>('swagger.password');
  if (swaggerUser && swaggerPassword) {
    app.use(
      '/api/docs',
      (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
      ) => {
        const auth = req.headers.authorization;
        const expected = Buffer.from(
          `${swaggerUser}:${swaggerPassword}`,
        ).toString('base64');
        if (auth === `Basic ${expected}`) return next();
        res.set('WWW-Authenticate', 'Basic realm="Swagger Docs"');
        res.status(401).send('Unauthorized');
      },
    );
  }

  SwaggerModule.setup('api/docs', app, documentFactory);

  app.setGlobalPrefix('api');

  app.use(express.json());

  SwaggerModule.setup('api/docs', app, documentFactory);

  app.enableShutdownHooks();

  const port = app.get(ConfigService).get<number>('port', 3000);
  await app.listen(port);
}
void bootstrap();
