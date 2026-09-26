import { Global, Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { createLoggerConfig } from './logging.config';
import { UserContextInterceptor } from './user-context.interceptor';

@Global()
@Module({
  imports: [LoggerModule.forRoot(createLoggerConfig())],
  providers: [UserContextInterceptor],
  exports: [LoggerModule, UserContextInterceptor],
})
export class LoggingModule {}
