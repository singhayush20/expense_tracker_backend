import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { EmailVerification } from '../../entity/email-verification.entity';

@Injectable()
export class EmailVerificationCleanupService {
  private readonly logger = new Logger(EmailVerificationCleanupService.name);

  constructor(
    @InjectRepository(EmailVerification)
    private readonly verificationRepository: Repository<EmailVerification>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredVerifications() {
    try {
      const result = await this.verificationRepository.delete({
        expiresAt: LessThan(new Date()),
      });

      if (result.affected && result.affected > 0) {
        this.logger.log(
          `Cleaned up ${result.affected} expired email verification records`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Failed to cleanup expired email verifications',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
