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
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { RolesGuard } from './guards/roles.guard';
import { AuthIdentity } from '../user/entity/auth-identity.entity';
import { PasswordCredential } from '../user/entity/password-credential.entity';
import { UserRole } from '../user/entity/user-role.entity';
import { User } from '../user/entity/user.entity';

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
