import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AuthIdentityProvider } from '../../enums';
import { UserStatus } from '../../../user/enum';
import { Session } from '../../entity';
import { PasswordCredential, AuthIdentity, User } from '../../../user/entity';
import { DeviceContext, LoginResponseDto, RefreshResponseDto } from '../../dto';
import { UserService } from '../../../user/service/user.service';
import { AuthTokenService } from '../auth-token/auth-token.service';
import { GoogleAuthService } from '../google-auth/google-auth.service';
import { SessionService } from '../session/session.service';
import { PasswordService } from '../password/password.service';

@Injectable()
export class AuthService {
  private readonly accessTokenExpiresInSeconds: number;

  constructor(
    private readonly usersService: UserService,
    private readonly passwordService: PasswordService,
    private readonly googleAuthService: GoogleAuthService,
    private readonly sessionService: SessionService,
    private readonly authTokenService: AuthTokenService,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    this.accessTokenExpiresInSeconds = this.configService.get<number>(
      'tokens.accessTokenExpiresInSeconds',
    )!;
  }

  async registerWithEmail(
    email: string,
    password: string,
    displayName: string,
    device?: DeviceContext,
  ): Promise<LoginResponseDto> {
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await this.usersService.findByEmail(normalizedEmail);

    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await this.passwordService.hash(password);

    const user = await this.dataSource.transaction(async (manager) => {
      const createdUser = manager.create(User, {
        email: normalizedEmail,
        displayName,
        emailVerified: false,
        status: UserStatus.ACTIVE,
      });

      const savedUser = await manager.save(createdUser);

      const credential = manager.create(PasswordCredential, {
        userId: savedUser.id,
        passwordHash,
      });

      await manager.save(credential);

      const identity = manager.create(AuthIdentity, {
        userId: savedUser.id,
        provider: AuthIdentityProvider.EMAIL,
        providerUserId: null,
      });

      await manager.save(identity);

      return savedUser;
    });

    return this.createSessionResponse(user.id, device);
  }

  async loginWithEmail(
    email: string,
    password: string,
    device?: DeviceContext,
  ): Promise<LoginResponseDto> {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User account is not active');
    }

    const credential = await this.usersService.getPasswordCredential(user.id);

    if (!credential) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await this.passwordService.verify(
      credential.passwordHash,
      password,
    );

    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.createSessionResponse(user.id, device);
  }

  async loginWithGoogle(
    idToken: string,
    device?: DeviceContext,
  ): Promise<LoginResponseDto> {
    const googleUser = await this.googleAuthService.verifyIdToken(idToken);

    let user = await this.usersService.findByGoogleSubject(googleUser.subject);

    if (!user) {
      user = await this.usersService.findByEmail(googleUser.email);

      if (user) {
        /*
         * Do not silently merge accounts here.
         *
         * If this email already belongs to an existing
         * email/password account, require an explicit
         * authenticated account-linking flow.
         */
        throw new ConflictException(
          'An account already exists with this email.',
        );
      }

      user = await this.dataSource.transaction(async (manager) => {
        const newUser = manager.create(User, {
          email: googleUser.email,
          emailVerified: googleUser.emailVerified,
          displayName: googleUser.displayName,
          avatarUrl: googleUser.avatarUrl,
          status: UserStatus.ACTIVE,
        });

        const savedUser = await manager.save(newUser);

        const identity = manager.create(AuthIdentity, {
          userId: savedUser.id,
          provider: AuthIdentityProvider.GOOGLE,
          providerUserId: googleUser.subject,
        });

        await manager.save(identity);

        return savedUser;
      });
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User account is not active');
    }

    return this.createSessionResponse(user.id, device);
  }

  private async createSessionResponse(
    userId: string,
    device?: DeviceContext,
  ): Promise<LoginResponseDto> {
    const { session, refreshToken } = await this.sessionService.createSession({
      userId,
      ...device,
    });

    const roles = await this.usersService.getUserRoles(userId);

    const accessToken = await this.authTokenService.createAccessToken({
      sub: userId,
      sid: session.id,
      roles,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenExpiresInSeconds,
      user: {
        id: userId,
        roles,
      },
    };
  }

  async refresh(session: Session): Promise<RefreshResponseDto> {
    const user = await this.usersService.findById(session.userId);

    if (user.status !== UserStatus.ACTIVE) {
      await this.sessionService.revokeSession(session.id);

      throw new UnauthorizedException('User account is not active');
    }

    const newRefreshToken =
      await this.sessionService.rotateRefreshToken(session);

    const roles = await this.usersService.getUserRoles(user.id);

    const accessToken = await this.authTokenService.createAccessToken({
      sub: user.id,
      sid: session.id,
      roles,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: this.accessTokenExpiresInSeconds,
      user: {
        id: user.id,
        email: user.email ?? null,
        roles,
      },
    };
  }

  async logout(sessionId: string) {
    await this.sessionService.revokeSession(sessionId);
  }
}
