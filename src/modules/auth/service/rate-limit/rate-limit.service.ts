import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../../../cache/cache.service';
import { AppException } from '../../../../exceptionn-handling/app-exception';
import { ExceptionCodes } from '../../../../exceptionn-handling/exception-codes';

interface RateLimitConfig {
  max: number;
  windowSeconds: number;
}

@Injectable()
export class RateLimitService {
  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {}

  private getRateLimitKey(type: string, identifier: string): string {
    return `rate_limit:${type}:${identifier}`;
  }

  async checkRateLimit(
    type: string,
    identifier: string,
    config: RateLimitConfig,
  ): Promise<void> {
    const key = this.getRateLimitKey(type, identifier);
    const current = await this.cacheService.get<number>(key);

    if (current !== null && current >= config.max) {
      throw new AppException(
        ExceptionCodes.TOO_MANY_VERIFICATION_ATTEMPTS,
        'Too many requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const newValue = (current ?? 0) + 1;
    await this.cacheService.set(key, newValue, config.windowSeconds);
  }

  async checkRegistrationLimit(ip: string): Promise<void> {
    const config: RateLimitConfig = {
      max: this.configService.get<number>('rateLimit.register.max') ?? 5,
      windowSeconds:
        this.configService.get<number>('rateLimit.register.windowSeconds') ??
        3600,
    };

    await this.checkRateLimit('register_ip', ip, config);
  }

  async checkVerificationLimit(ip: string, email: string): Promise<void> {
    const ipConfig: RateLimitConfig = {
      max: this.configService.get<number>('rateLimit.verify.ipMax') ?? 10,
      windowSeconds:
        this.configService.get<number>('rateLimit.verify.ipWindowSeconds') ??
        900,
    };

    const emailConfig: RateLimitConfig = {
      max: this.configService.get<number>('rateLimit.verify.emailMax') ?? 5,
      windowSeconds:
        this.configService.get<number>('rateLimit.verify.emailWindowSeconds') ??
        900,
    };

    await this.checkRateLimit('verify_ip', ip, ipConfig);
    await this.checkRateLimit('verify_email', email, emailConfig);
  }

  async checkResendLimit(ip: string, email: string): Promise<void> {
    const ipConfig: RateLimitConfig = {
      max: this.configService.get<number>('rateLimit.resend.ipMax') ?? 3,
      windowSeconds:
        this.configService.get<number>('rateLimit.resend.ipWindowSeconds') ??
        3600,
    };

    const emailConfig: RateLimitConfig = {
      max: this.configService.get<number>('rateLimit.resend.emailMax') ?? 3,
      windowSeconds:
        this.configService.get<number>('rateLimit.resend.emailWindowSeconds') ??
        3600,
    };

    await this.checkRateLimit('resend_ip', ip, ipConfig);
    await this.checkRateLimit('resend_email', email, emailConfig);
  }
}
