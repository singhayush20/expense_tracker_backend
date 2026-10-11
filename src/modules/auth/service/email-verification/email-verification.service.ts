import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../user/entity/user.entity';
import { OtpService } from './otp.service';
import { OtpData } from '../../dto/otp-data.dto';
import { OtpPurpose } from '../../enums/otp-purpose.enum';
import { EmailService } from '../../../../core/email/email.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { AppException } from '../../../../exceptionn-handling/app-exception';
import { ExceptionCodes } from '../../../../exceptionn-handling/exception-codes';

@Injectable()
export class EmailVerificationService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly otpService: OtpService,

    private readonly emailService: EmailService,

    private readonly rateLimitService: RateLimitService,
  ) {}

  async sendVerificationEmail(user: User): Promise<void> {
    if (user.emailVerified) {
      return;
    }

    // Check resend cooldown (shared OTP helper, avoids duplication)
    await this.otpService.assertCooldownAvailable(
      user.email!,
      OtpPurpose.EMAIL_VERIFICATION,
    );

    // Generate and store OTP
    const otp = this.otpService.generateOtp();

    const otpHash = await this.otpService.hashOtp(otp);

    const otpData: OtpData = {
      otpHash,
      userId: user.id,
      attempts: 0,
      createdAt: Date.now(),
    };

    await this.otpService.storeOtp(
      user.email!,
      otpData,
      OtpPurpose.EMAIL_VERIFICATION,
    );

    // Send email
    try {
      await this.emailService.sendEmailVerificationOtp(user.email!, otp);
    } catch (error) {
      // Clean up OTP if email fails
      await this.otpService.deleteOtp(
        user.email!,
        OtpPurpose.EMAIL_VERIFICATION,
      );

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

    const otpData = await this.otpService.getOtpData(
      normalizedEmail,
      OtpPurpose.EMAIL_VERIFICATION,
    );

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
      await this.otpService.incrementAttempts(
        normalizedEmail,
        OtpPurpose.EMAIL_VERIFICATION,
      );

      throw new AppException(
        ExceptionCodes.INVALID_VERIFICATION_CODE,
        'Invalid verification code.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Mark as verified and delete OTP
    user.emailVerified = true;

    await this.userRepository.save(user);

    await this.otpService.deleteOtp(
      normalizedEmail,
      OtpPurpose.EMAIL_VERIFICATION,
    );

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
