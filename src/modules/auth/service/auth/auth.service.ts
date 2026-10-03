import { HttpStatus, Injectable } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AuthIdentityProvider } from '../../enums';
import { UserStatus } from '../../../user/enum';
import { Session } from '../../entity';
import { PasswordCredential, AuthIdentity, User } from '../../../user/entity';
import {
  DeviceContext,
  LoginResponseDto,
  RefreshResponseDto,
  EmailRegisterResponseDto,
} from '../../dto';
import { UserService } from '../../../user/service/user.service';
import { AuthTokenService } from '../auth-token/auth-token.service';
import { GoogleAuthService } from '../google-auth/google-auth.service';
import { SessionService } from '../session/session.service';
import { PasswordService } from '../password/password.service';
import { EmailVerificationService } from '../email-verification/email-verification.service';
import { AppException } from '../../../../exceptionn-handling/app-exception';
import { ExceptionCodes } from '../../../../exceptionn-handling/exception-codes';

@Injectable()
export class AuthService {
  private readonly accessTokenExpiresInSeconds: number;

  constructor(
    private readonly usersService: UserService,
    private readonly passwordService: PasswordService,
    private readonly googleAuthService: GoogleAuthService,
    private readonly sessionService: SessionService,
    private readonly authTokenService: AuthTokenService,
    private readonly emailVerificationService: EmailVerificationService,
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
  ): Promise<EmailRegisterResponseDto> {
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await this.usersService.findByEmail(normalizedEmail);

    if (existing) {
      throw new AppException(
        ExceptionCodes.USER_ALREADY_EXISTS,
        'An account with this email already exists',
        HttpStatus.CONFLICT,
      );
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

    await this.emailVerificationService.sendVerificationEmail(user);

    return {
      verificationRequired: true,
    };
  }

  async loginWithEmail(
    email: string,
    password: string,
    device?: DeviceContext,
  ): Promise<LoginResponseDto> {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      throw new AppException(
        ExceptionCodes.INVALID_CREDENTIALS,
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new AppException(
        ExceptionCodes.USER_ACCOUNT_NOT_ACTIVE,
        'User account is not active',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!user.emailVerified) {
      await this.emailVerificationService.sendVerificationEmail(user);

      throw new AppException(
        ExceptionCodes.EMAIL_NOT_VERIFIED,
        'Please verify your email before signing in. A new verification code has been sent to your email.',
        HttpStatus.FORBIDDEN,
      );
    }

    const credential = await this.usersService.getPasswordCredential(user.id);

    if (!credential) {
      throw new AppException(
        ExceptionCodes.INVALID_CREDENTIALS,
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const valid = await this.passwordService.verify(
      credential.passwordHash,
      password,
    );

    if (!valid) {
      throw new AppException(
        ExceptionCodes.INVALID_CREDENTIALS,
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED,
      );
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
        throw new AppException(
          ExceptionCodes.USER_ALREADY_EXISTS,
          'An account already exists with this email.',
          HttpStatus.CONFLICT,
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
      throw new AppException(
        ExceptionCodes.USER_ACCOUNT_NOT_ACTIVE,
        'User account is not active',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return this.createSessionResponse(user.id, device);
  }

  async verifyEmail(
    email: string,
    otp: string,
    device?: DeviceContext,
  ): Promise<LoginResponseDto> {
    const user = await this.emailVerificationService.verifyEmail(email, otp);

    return this.createSessionResponse(user.id, device);
  }

  async resendVerificationEmail(email: string): Promise<void> {
    await this.emailVerificationService.resendVerificationEmail(email);
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

      throw new AppException(
        ExceptionCodes.USER_ACCOUNT_NOT_ACTIVE,
        'User account is not active',
        HttpStatus.UNAUTHORIZED,
      );
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
