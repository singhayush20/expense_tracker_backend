import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  /**
   * Replace Nest's default logger with Pino.
   */
  app.useLogger(app.get(Logger));

  const port = Number(process.env.PORT ?? 3000);

  await app.listen(port);
}
void bootstrap();
