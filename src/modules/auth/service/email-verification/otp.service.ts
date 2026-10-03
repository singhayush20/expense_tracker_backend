import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomInt } from 'crypto';
import { AppException } from '../../../../exceptionn-handling/app-exception';
import { ExceptionCodes } from '../../../../exceptionn-handling/exception-codes';

@Injectable()
export class OtpService {
  private readonly otpLength: number;
  private readonly expiryMinutes: number;
  private readonly maxAttempts: number;

  constructor(private readonly configService: ConfigService) {
    this.otpLength =
      this.configService.get<number>('EMAIL_VERIFICATION_OTP_LENGTH') ?? 6;

    this.expiryMinutes =
      this.configService.get<number>('EMAIL_VERIFICATION_EXPIRES_IN_MINUTES') ??
      10;

    this.maxAttempts =
      this.configService.get<number>('EMAIL_VERIFICATION_MAX_ATTEMPTS') ?? 5;
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

  getExpiryDate(): Date {
    return new Date(Date.now() + this.expiryMinutes * 60 * 1000);
  }

  getMaxAttempts(): number {
    return this.maxAttempts;
  }

  assertNotExpired(expiresAt: Date): void {
    if (expiresAt.getTime() <= Date.now()) {
      throw new AppException(
        ExceptionCodes.VERIFICATION_CODE_EXPIRED,
        'Verification code has expired.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  assertAttemptsAvailable(attempts: number, maxAttempts: number): void {
    if (attempts >= maxAttempts) {
      throw new AppException(
        ExceptionCodes.TOO_MANY_VERIFICATION_ATTEMPTS,
        'Too many invalid verification attempts. Please request a new code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
