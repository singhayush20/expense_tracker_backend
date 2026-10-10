import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { CacheService } from '../../../../cache/cache.service';
import { EmailService } from '../../../../core/email/email.service';
import { AppException } from '../../../../exceptionn-handling/app-exception';
import { ExceptionCodes } from '../../../../exceptionn-handling/exception-codes';
import { PasswordCredential } from '../../../user/entity';
import { UserStatus } from '../../../user/enum';
import { UserService } from '../../../user/service/user.service';
import { VerifyPasswordResetResponseDto } from '../../dto';
import { OtpData } from '../../dto/otp-data.dto';
import { OtpPurpose } from '../../enums/otp-purpose.enum';
import { AuthTokenService } from '../auth-token/auth-token.service';
import { OtpService } from '../email-verification/otp.service';
import { PasswordService } from '../password/password.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { SessionService } from '../session/session.service';

interface PasswordResetTokenData {
  userId: string;
  email: string;
  createdAt: number;
}

@Injectable()
export class PasswordResetService {
  private readonly resetTokenExpiresInMinutes: number;

  constructor(
    @InjectRepository(PasswordCredential)
    private readonly passwordCredentialsRepository: Repository<PasswordCredential>,
    private readonly usersService: UserService,
    private readonly passwordService: PasswordService,
    private readonly otpService: OtpService,
    private readonly emailService: EmailService,
    private readonly rateLimitService: RateLimitService,
    private readonly sessionService: SessionService,
    private readonly authTokenService: AuthTokenService,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {
    this.resetTokenExpiresInMinutes =
      this.configService.get<number>(
        'passwordReset.resetTokenExpiresInMinutes',
      ) ?? 15;
  }

  private getResetTokenKey(tokenHash: string): string {
    return `password_reset_token:${tokenHash}`;
  }

  async requestPasswordReset(email: string, ip?: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();

    await this.rateLimitService.checkPasswordResetRequestLimit(
      ip,
      normalizedEmail,
    );

    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user || !user.email) {
      throw new AppException(
        ExceptionCodes.USER_NOT_FOUND,
        'No account found with this email.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new AppException(
        ExceptionCodes.USER_ACCOUNT_NOT_ACTIVE,
        'User account is not active.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!user.emailVerified) {
      throw new AppException(
        ExceptionCodes.EMAIL_NOT_VERIFIED,
        'Please verify your email before resetting your password.',
        HttpStatus.FORBIDDEN,
      );
    }

    const credential = await this.usersService.getPasswordCredential(user.id);

    if (!credential) {
      throw new AppException(
        ExceptionCodes.PASSWORD_RESET_NOT_AVAILABLE,
        'Password reset is not available for this account. It may use social sign-in.',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.otpService.assertCooldownAvailable(
      normalizedEmail,
      OtpPurpose.PASSWORD_RESET,
    );

    const otp = this.otpService.generateOtp();
    const otpHash = await this.otpService.hashOtp(otp);

    const otpData: OtpData = {
      otpHash,
      userId: user.id,
      attempts: 0,
      createdAt: Date.now(),
    };

    await this.otpService.storeOtp(
      normalizedEmail,
      otpData,
      OtpPurpose.PASSWORD_RESET,
    );

    try {
      await this.emailService.sendPasswordResetOtp(normalizedEmail, otp);
    } catch (error) {
      await this.otpService.deleteOtp(
        normalizedEmail,
        OtpPurpose.PASSWORD_RESET,
      );

      throw error;
    }
  }

  async verifyPasswordResetOtp(
    email: string,
    otp: string,
    ip?: string,
  ): Promise<VerifyPasswordResetResponseDto> {
    const normalizedEmail = email.toLowerCase().trim();

    await this.rateLimitService.checkPasswordResetVerifyLimit(
      ip,
      normalizedEmail,
    );

    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      throw new AppException(
        ExceptionCodes.INVALID_VERIFICATION_CODE,
        'Invalid verification code.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new AppException(
        ExceptionCodes.USER_ACCOUNT_NOT_ACTIVE,
        'User account is not active.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const otpData = await this.otpService.getOtpData(
      normalizedEmail,
      OtpPurpose.PASSWORD_RESET,
    );

    if (!otpData) {
      throw new AppException(
        ExceptionCodes.NO_VERIFICATION_FOUND,
        'No active password reset request exists. Please request a new code.',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.otpService.assertAttemptsAvailable(otpData.attempts);
    this.otpService.assertNotExpired(otpData.createdAt);

    const valid = await this.otpService.verifyOtp(otp, otpData.otpHash);

    if (!valid) {
      await this.otpService.incrementAttempts(
        normalizedEmail,
        OtpPurpose.PASSWORD_RESET,
      );

      throw new AppException(
        ExceptionCodes.INVALID_VERIFICATION_CODE,
        'Invalid verification code.',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.otpService.deleteOtp(normalizedEmail, OtpPurpose.PASSWORD_RESET);

    const resetToken = this.authTokenService.createRefreshToken();
    const tokenHash = this.authTokenService.hashRefreshToken(resetToken);

    const tokenData: PasswordResetTokenData = {
      userId: user.id,
      email: normalizedEmail,
      createdAt: Date.now(),
    };

    await this.cacheService.set(
      this.getResetTokenKey(tokenHash),
      tokenData,
      this.resetTokenExpiresInMinutes * 60,
    );

    return {
      resetToken,
      expiresInMinutes: this.resetTokenExpiresInMinutes,
    };
  }

  async resetPassword(
    email: string,
    resetToken: string,
    newPassword: string,
    ip?: string,
  ): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();

    await this.rateLimitService.checkPasswordResetResetLimit(
      ip,
      normalizedEmail,
    );

    const tokenHash = this.authTokenService.hashRefreshToken(resetToken);
    const tokenData = await this.cacheService.get<PasswordResetTokenData>(
      this.getResetTokenKey(tokenHash),
    );

    if (!tokenData || tokenData.email !== normalizedEmail) {
      throw new AppException(
        ExceptionCodes.INVALID_PASSWORD_RESET_TOKEN,
        'Invalid or expired password reset token. Please restart the reset flow.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const tokenExpiresAt =
      tokenData.createdAt + this.resetTokenExpiresInMinutes * 60 * 1000;

    if (tokenExpiresAt <= Date.now()) {
      await this.cacheService.delete(this.getResetTokenKey(tokenHash));

      throw new AppException(
        ExceptionCodes.PASSWORD_RESET_TOKEN_EXPIRED,
        'Password reset token has expired. Please restart the reset flow.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user || user.id !== tokenData.userId) {
      throw new AppException(
        ExceptionCodes.INVALID_PASSWORD_RESET_TOKEN,
        'Invalid or expired password reset token. Please restart the reset flow.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new AppException(
        ExceptionCodes.USER_ACCOUNT_NOT_ACTIVE,
        'User account is not active.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const credential = await this.usersService.getPasswordCredential(user.id);

    if (!credential) {
      throw new AppException(
        ExceptionCodes.PASSWORD_RESET_NOT_AVAILABLE,
        'Password reset is not available for this account. It may use social sign-in.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const passwordHash = await this.passwordService.hash(newPassword);

    credential.passwordHash = passwordHash;
    await this.passwordCredentialsRepository.save(credential);

    // Single-use: consume the token before revoking sessions.
    await this.cacheService.delete(this.getResetTokenKey(tokenHash));

    await this.sessionService.revokeAllUserSessions(user.id);
  }
}
