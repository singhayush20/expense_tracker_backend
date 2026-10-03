import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomInt } from 'crypto';
import { CacheService } from '../../../../cache/cache.service';
import { AppException } from '../../../../exceptionn-handling/app-exception';
import { ExceptionCodes } from '../../../../exceptionn-handling/exception-codes';
import { OtpData } from '../../dto/otp-data.dto';

@Injectable()
export class OtpService {
  private readonly otpLength: number;
  private readonly expiryMinutes: number;
  private readonly maxAttempts: number;

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

  private getOtpKey(email: string): string {
    return `email_verification:${email.toLowerCase().trim()}`;
  }

  async storeOtp(email: string, otpData: OtpData): Promise<void> {
    const key = this.getOtpKey(email);
    const ttlSeconds = this.expiryMinutes * 60;

    await this.cacheService.set(key, otpData, ttlSeconds);
  }

  async getOtpData(email: string): Promise<OtpData | null> {
    const key = this.getOtpKey(email);
    return this.cacheService.get<OtpData>(key);
  }

  async incrementAttempts(email: string): Promise<number> {
    const data = await this.getOtpData(email);

    if (!data) {
      throw new AppException(
        ExceptionCodes.NO_VERIFICATION_FOUND,
        'No active verification code exists. Please request a new code.',
        HttpStatus.BAD_REQUEST,
      );
    }

    data.attempts += 1;

    const key = this.getOtpKey(email);
    const ttlSeconds = this.expiryMinutes * 60;

    await this.cacheService.set(key, data, ttlSeconds);

    return data.attempts;
  }

  async deleteOtp(email: string): Promise<void> {
    const key = this.getOtpKey(email);
    await this.cacheService.delete(key);
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
