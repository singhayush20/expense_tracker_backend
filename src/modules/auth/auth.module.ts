import { Module } from '@nestjs/common';
import { PasswordService } from './service/password/password.service';
import { AuthTokenService } from './service/auth-token/auth-token.service';
import { SessionService } from './service/session/session.service';
import { GoogleAuthService } from './service/google-auth/google-auth.service';
import { AuthService } from './service/auth/auth.service';
import { AuthController } from './controller/auth.controller';
import { UserModule } from '../user/user.module';
import { Session } from './entity/session.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    UserModule,

    TypeOrmModule.forFeature([Session]),

    JwtModule.register({}),
  ],
  providers: [
    PasswordService,
    AuthTokenService,
    SessionService,
    GoogleAuthService,
    AuthService,
  ],
  controllers: [AuthController],
})
export class AuthModule {}
