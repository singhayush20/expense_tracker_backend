import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Session } from './entity';
import {
  AuthIdentity,
  PasswordCredential,
  UserRole,
  User,
} from '../user/entity';
import { UserModule } from '../user/user.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { RolesGuard } from './guards/roles.guard';
import { AuthController } from './controller/auth.controller';
import { AuthTokenService } from './service/auth-token/auth-token.service';
import { AuthService } from './service/auth/auth.service';
import { GoogleAuthService } from './service/google-auth/google-auth.service';
import { PasswordService } from './service/password';
import { SessionService } from './service/session/session.service';

@Module({
  imports: [
    UserModule,
    TypeOrmModule.forFeature([
      User,
      AuthIdentity,
      PasswordCredential,
      UserRole,
      Session,
    ]),
    JwtModule.register({}),
  ],
  providers: [
    PasswordService,
    AuthTokenService,
    SessionService,
    GoogleAuthService,
    AuthService,
    JwtAuthGuard,
    RefreshTokenGuard,
    RolesGuard,
  ],
  controllers: [AuthController],
  exports: [
    AuthService,
    AuthTokenService,
    SessionService,
    JwtAuthGuard,
    RefreshTokenGuard,
    RolesGuard,
  ],
})
export class AuthModule {}
