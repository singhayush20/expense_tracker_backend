import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../../../user/entity/user.entity';
import { OtpService } from './otp.service';
import { OtpData } from '../../dto/otp-data.dto';
import { EmailService } from '../../../../core/email/email.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { AppException } from '../../../../exceptionn-handling/app-exception';
import { ExceptionCodes } from '../../../../exceptionn-handling/exception-codes';

@Injectable()
export class EmailVerificationService {
  private readonly resendCooldownSeconds: number;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly otpService: OtpService,

    private readonly emailService: EmailService,

    private readonly rateLimitService: RateLimitService,

    private readonly configService: ConfigService,
  ) {
    this.resendCooldownSeconds =
      this.configService.get<number>(
        'emailVerification.resendCooldownSeconds',
      ) ?? 60;
  }

  async sendVerificationEmail(user: User): Promise<void> {
    if (user.emailVerified) {
      return;
    }

    // Check resend cooldown
    const existingData = await this.otpService.getOtpData(user.email!);

    if (existingData) {
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

    // Generate and store OTP
    const otp = this.otpService.generateOtp();

    const otpHash = await this.otpService.hashOtp(otp);

    const otpData: OtpData = {
      otpHash,
      userId: user.id,
      attempts: 0,
      createdAt: Date.now(),
    };

    await this.otpService.storeOtp(user.email!, otpData);

    // Send email
    try {
      await this.emailService.sendEmailVerificationOtp(user.email!, otp);
    } catch (error) {
      // Clean up OTP if email fails
      await this.otpService.deleteOtp(user.email!);

      throw error;
    }
  }

  async verifyEmail(email: string, otp: string, ip?: string): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase();

    // Check rate limits
    if (ip) {
      await this.rateLimitService.checkVerificationLimit(ip, normalizedEmail);
    }

    const user = await this.userRepository.findOne({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user) {
      throw new AppException(
        ExceptionCodes.INVALID_VERIFICATION_CODE,
        'Invalid verification code.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (user.emailVerified) {
      throw new AppException(
        ExceptionCodes.EMAIL_ALREADY_VERIFIED,
        'Email is already verified.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const otpData = await this.otpService.getOtpData(normalizedEmail);

    if (!otpData) {
      throw new AppException(
        ExceptionCodes.NO_VERIFICATION_FOUND,
        'No active verification code exists. Please request a new code.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate attempt count
    this.otpService.assertAttemptsAvailable(otpData.attempts);

    // Validate expiry
    this.otpService.assertNotExpired(otpData.createdAt);

    // Verify OTP
    const valid = await this.otpService.verifyOtp(otp, otpData.otpHash);

    if (!valid) {
      // Increment attempts and throw error
      await this.otpService.incrementAttempts(normalizedEmail);

      throw new AppException(
        ExceptionCodes.INVALID_VERIFICATION_CODE,
        'Invalid verification code.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Mark as verified and delete OTP
    user.emailVerified = true;

    await this.userRepository.save(user);

    await this.otpService.deleteOtp(normalizedEmail);

    return user;
  }

  async resendVerificationEmail(email: string, ip?: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();

    // Check rate limits
    if (ip) {
      await this.rateLimitService.checkResendLimit(ip, normalizedEmail);
    }

    const user = await this.userRepository.findOne({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user || user.emailVerified) {
      // Don't reveal whether email exists or is already verified
      return;
    }

    await this.sendVerificationEmail(user);
  }
}
