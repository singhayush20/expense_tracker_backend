import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisService } from './cache/redis/redis.service';
import { ConfigServiceService } from './config/config-service/config-service.service';
import { LoggingModule } from './logging/logging.module';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { UserContextInterceptor } from './logging/user-context.interceptor';

@Module({
  controllers: [AppController],
  providers: [
    AppService,
    RedisService,
    ConfigServiceService,
    {
      provide: APP_INTERCEPTOR,
      useClass: UserContextInterceptor,
    },

    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
  imports: [LoggingModule],
})
export class AppModule {}
