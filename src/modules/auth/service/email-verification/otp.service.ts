import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomInt } from 'crypto';
import { CacheService } from '../../../../cache/cache.service';
import { AppException } from '../../../../exceptionn-handling/app-exception';
import { ExceptionCodes } from '../../../../exceptionn-handling/exception-codes';
import { OtpData } from '../../dto/otp-data.dto';
import { OtpPurpose } from '../../enums/otp-purpose.enum';

@Injectable()
export class OtpService {
  private readonly otpLength: number;
  private readonly expiryMinutes: number;
  private readonly maxAttempts: number;
  private readonly resendCooldownSeconds: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    this.otpLength =
      this.configService.get<number>('emailVerification.otpLength') ?? 6;

    this.expiryMinutes =
      this.configService.get<number>('emailVerification.expiresInMinutes') ??
      10;

    this.maxAttempts =
      this.configService.get<number>('emailVerification.maxAttempts') ?? 5;

    this.resendCooldownSeconds =
      this.configService.get<number>(
        'emailVerification.resendCooldownSeconds',
      ) ?? 60;
  }

  generateOtp(): string {
    const min = 10 ** (this.otpLength - 1);
    const max = 10 ** this.otpLength;

    return randomInt(min, max).toString();
  }

  async hashOtp(otp: string): Promise<string> {
    return argon2.hash(otp);
  }

  async verifyOtp(otp: string, otpHash: string): Promise<boolean> {
    try {
      return await argon2.verify(otpHash, otp);
    } catch {
      return false;
    }
  }

  private getOtpKey(
    email: string,
    purpose: OtpPurpose = OtpPurpose.EMAIL_VERIFICATION,
  ): string {
    const prefix =
      purpose === OtpPurpose.PASSWORD_RESET
        ? 'password_reset'
        : 'email_verification';

    return `${prefix}:${email.toLowerCase().trim()}`;
  }

  async storeOtp(
    email: string,
    otpData: OtpData,
    purpose: OtpPurpose = OtpPurpose.EMAIL_VERIFICATION,
  ): Promise<void> {
    const key = this.getOtpKey(email, purpose);
    const ttlSeconds = this.expiryMinutes * 60;

    await this.cacheService.set(key, otpData, ttlSeconds);
  }

  async getOtpData(
    email: string,
    purpose: OtpPurpose = OtpPurpose.EMAIL_VERIFICATION,
  ): Promise<OtpData | null> {
    const key = this.getOtpKey(email, purpose);
    return this.cacheService.get<OtpData>(key);
  }

  async incrementAttempts(
    email: string,
    purpose: OtpPurpose = OtpPurpose.EMAIL_VERIFICATION,
  ): Promise<number> {
    const key = this.getOtpKey(email, purpose);
    const data = await this.getOtpData(email, purpose);

    if (!data) {
      throw new AppException(
        ExceptionCodes.NO_VERIFICATION_FOUND,
        'No active verification code exists. Please request a new code.',
        HttpStatus.BAD_REQUEST,
      );
    }

    data.attempts += 1;

    // Preserve the original expiry instead of extending it: re-saving with a
    // full TTL would keep the OTP alive indefinitely on repeated guesses.
    const remainingTtl = await this.cacheService.ttl(key);

    if (remainingTtl <= 0) {
      await this.cacheService.delete(key);

      throw new AppException(
        ExceptionCodes.VERIFICATION_CODE_EXPIRED,
        'Verification code has expired.',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.cacheService.set(key, data, remainingTtl);

    return data.attempts;
  }

  async deleteOtp(
    email: string,
    purpose: OtpPurpose = OtpPurpose.EMAIL_VERIFICATION,
  ): Promise<void> {
    const key = this.getOtpKey(email, purpose);
    await this.cacheService.delete(key);
  }

  async assertCooldownAvailable(
    email: string,
    purpose: OtpPurpose = OtpPurpose.EMAIL_VERIFICATION,
  ): Promise<void> {
    const existingData = await this.getOtpData(email, purpose);

    if (!existingData) {
      return;
    }

    const secondsSinceCreation = (Date.now() - existingData.createdAt) / 1000;

    if (secondsSinceCreation < this.resendCooldownSeconds) {
      throw new AppException(
        ExceptionCodes.RESEND_COOLDOWN_ACTIVE,
        `Please wait ${Math.ceil(
          this.resendCooldownSeconds - secondsSinceCreation,
        )} seconds before requesting another code.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  getExpiryMinutes(): number {
    return this.expiryMinutes;
  }

  getMaxAttempts(): number {
    return this.maxAttempts;
  }

  assertNotExpired(createdAt: number): void {
    const expiresAt = createdAt + this.expiryMinutes * 60 * 1000;

    if (expiresAt <= Date.now()) {
      throw new AppException(
        ExceptionCodes.VERIFICATION_CODE_EXPIRED,
        'Verification code has expired.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  assertAttemptsAvailable(attempts: number): void {
    if (attempts >= this.maxAttempts) {
      throw new AppException(
        ExceptionCodes.TOO_MANY_VERIFICATION_ATTEMPTS,
        'Too many invalid verification attempts. Please request a new code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
