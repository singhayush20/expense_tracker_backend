import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  EmailVerification,
  EmailVerificationPurpose,
} from '../../entity/email-verification.entity';
import { User } from '../../../user/entity/user.entity';
import { OtpService } from './otp.service';
import { EmailService } from '../../../../core/email/email.service';
import { AppException } from '../../../../exceptionn-handling/app-exception';
import { ExceptionCodes } from '../../../../exceptionn-handling/exception-codes';

@Injectable()
export class EmailVerificationService {
  private readonly resendCooldownSeconds: number;

  constructor(
    @InjectRepository(EmailVerification)
    private readonly verificationRepository: Repository<EmailVerification>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly otpService: OtpService,

    private readonly emailService: EmailService,

    private readonly configService: ConfigService,
  ) {
    this.resendCooldownSeconds =
      this.configService.get<number>(
        'EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS',
      ) ?? 60;
  }

  async sendVerificationEmail(user: User): Promise<void> {
    if (user.emailVerified) {
      return;
    }

    const existing = await this.verificationRepository.findOne({
      where: {
        userId: user.id,
        purpose: EmailVerificationPurpose.EMAIL_VERIFICATION,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    if (existing) {
      const secondsSinceCreation =
        (Date.now() - existing.createdAt.getTime()) / 1000;

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

    await this.verificationRepository
      .createQueryBuilder()
      .delete()
      .from(EmailVerification)
      .where('user_id = :userId', {
        userId: user.id,
      })
      .andWhere('purpose = :purpose', {
        purpose: EmailVerificationPurpose.EMAIL_VERIFICATION,
      })
      .execute();

    const otp = this.otpService.generateOtp();

    const otpHash = await this.otpService.hashOtp(otp);

    const verification = this.verificationRepository.create({
      userId: user.id,
      otpHash,
      purpose: EmailVerificationPurpose.EMAIL_VERIFICATION,
      expiresAt: this.otpService.getExpiryDate(),
      attempts: 0,
      maxAttempts: this.otpService.getMaxAttempts(),
      consumedAt: null,
    });

    await this.verificationRepository.save(verification);

    try {
      await this.emailService.sendEmailVerificationOtp(user.email!, otp);
    } catch (error) {
      await this.verificationRepository.delete(verification.id);

      throw error;
    }
  }

  async verifyEmail(email: string, otp: string): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase();

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

    const verification = await this.verificationRepository.findOne({
      where: {
        userId: user.id,
        purpose: EmailVerificationPurpose.EMAIL_VERIFICATION,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    if (!verification) {
      throw new AppException(
        ExceptionCodes.NO_VERIFICATION_FOUND,
        'No active verification code exists. Please request a new code.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (verification.consumedAt) {
      throw new AppException(
        ExceptionCodes.VERIFICATION_CODE_ALREADY_USED,
        'Verification code has already been used.',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.otpService.assertAttemptsAvailable(
      verification.attempts,
      verification.maxAttempts,
    );

    this.otpService.assertNotExpired(verification.expiresAt);

    const valid = await this.otpService.verifyOtp(otp, verification.otpHash);

    if (!valid) {
      verification.attempts += 1;

      await this.verificationRepository.save(verification);

      throw new AppException(
        ExceptionCodes.INVALID_VERIFICATION_CODE,
        'Invalid verification code.',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.userRepository.manager.transaction(async (manager) => {
      const lockedVerification = await manager.findOne(EmailVerification, {
        where: {
          id: verification.id,
        },
        lock: {
          mode: 'pessimistic_write',
        },
      });

      if (!lockedVerification || lockedVerification.consumedAt) {
        throw new AppException(
          ExceptionCodes.VERIFICATION_CODE_ALREADY_USED,
          'Verification code has already been used.',
          HttpStatus.BAD_REQUEST,
        );
      }

      lockedVerification.consumedAt = new Date();

      user.emailVerified = true;

      await manager.save(EmailVerification, lockedVerification);

      await manager.save(User, user);
    });

    return user;
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.userRepository.findOne({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user || user.emailVerified) {
      return;
    }

    await this.sendVerificationEmail(user);
  }
}
