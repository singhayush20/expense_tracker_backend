import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggingModule } from './logging/logging.module';
import { CacheModule } from './cache/cache.module';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { GlobalExceptionFilter } from './exceptionn-handling/global-exception.filter';
import { UserContextInterceptor } from './logging/user-context.interceptor';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { configValidationSchema } from './config/config-validation-schema';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import configuration from './config/configuration';

@Module({
  imports: [
    LoggingModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.ENVIRONMENT || 'dev'}`,
      load: [configuration],
      validationSchema: configValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        autoLoadEntities: true,
        synchronize: false,
        logging: ['error', 'warn'],
        retryAttempts: 1,
        retryDelay: 0,
      }),
    }),
    CacheModule,
    AuthModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: UserContextInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
