import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RateLimiterService } from '../../../../core/rate-limit/rate-limiter.service';
import { ExceptionCodes } from '../../../../exceptionn-handling/exception-codes';

@Injectable()
export class RateLimitService {
  constructor(
    private readonly configService: ConfigService,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  async checkRegistrationLimit(ip: string): Promise<void> {
    await this.rateLimiter.checkLimit(
      'register_ip',
      ip,
      this.configService.get<number>('rateLimit.register.max') ?? 5,
      this.configService.get<number>('rateLimit.register.windowSeconds') ??
        3600,
      ExceptionCodes.RATE_LIMIT_EXCEEDED_REGISTRATION,
    );
  }

  async checkVerificationLimit(ip: string, email: string): Promise<void> {
    await this.rateLimiter.checkLimit(
      'verify_ip',
      ip,
      this.configService.get<number>('rateLimit.verify.ipMax') ?? 10,
      this.configService.get<number>('rateLimit.verify.ipWindowSeconds') ?? 900,
      ExceptionCodes.RATE_LIMIT_EXCEEDED_VERIFICATION,
    );
    await this.rateLimiter.checkLimit(
      'verify_email',
      email,
      this.configService.get<number>('rateLimit.verify.emailMax') ?? 5,
      this.configService.get<number>('rateLimit.verify.emailWindowSeconds') ??
        900,
      ExceptionCodes.RATE_LIMIT_EXCEEDED_VERIFICATION,
    );
  }

  async checkResendLimit(ip: string, email: string): Promise<void> {
    await this.rateLimiter.checkLimit(
      'resend_ip',
      ip,
      this.configService.get<number>('rateLimit.resend.ipMax') ?? 3,
      this.configService.get<number>('rateLimit.resend.ipWindowSeconds') ??
        3600,
      ExceptionCodes.RATE_LIMIT_EXCEEDED_RESEND,
    );
    await this.rateLimiter.checkLimit(
      'resend_email',
      email,
      this.configService.get<number>('rateLimit.resend.emailMax') ?? 3,
      this.configService.get<number>('rateLimit.resend.emailWindowSeconds') ??
        3600,
      ExceptionCodes.RATE_LIMIT_EXCEEDED_RESEND,
    );
  }

  async checkLoginLimit(ip: string, email: string): Promise<void> {
    await this.rateLimiter.checkLimit(
      'login_ip',
      ip,
      this.configService.get<number>('rateLimit.login.ipMax') ?? 10,
      this.configService.get<number>('rateLimit.login.ipWindowSeconds') ?? 900,
      ExceptionCodes.RATE_LIMIT_EXCEEDED_LOGIN,
    );
    await this.rateLimiter.checkLimit(
      'login_email',
      email,
      this.configService.get<number>('rateLimit.login.emailMax') ?? 5,
      this.configService.get<number>('rateLimit.login.emailWindowSeconds') ??
        900,
      ExceptionCodes.RATE_LIMIT_EXCEEDED_LOGIN,
    );
  }

  async checkGoogleOAuthLimit(ip: string): Promise<void> {
    await this.rateLimiter.checkLimit(
      'google_oauth_ip',
      ip,
      this.configService.get<number>('rateLimit.googleOAuth.ipMax') ?? 10,
      this.configService.get<number>('rateLimit.googleOAuth.ipWindowSeconds') ??
        900,
      ExceptionCodes.RATE_LIMIT_EXCEEDED_GOOGLE_OAUTH,
    );
  }

  async checkTokenRefreshLimit(userId: string): Promise<void> {
    await this.rateLimiter.checkLimit(
      'token_refresh_user',
      userId,
      this.configService.get<number>('rateLimit.tokenRefresh.userMax') ?? 20,
      this.configService.get<number>(
        'rateLimit.tokenRefresh.userWindowSeconds',
      ) ?? 900,
      ExceptionCodes.RATE_LIMIT_EXCEEDED_TOKEN_REFRESH,
    );
  }

  async checkLogoutLimit(userId: string): Promise<void> {
    await this.rateLimiter.checkLimit(
      'logout_user',
      userId,
      this.configService.get<number>('rateLimit.logout.userMax') ?? 50,
      this.configService.get<number>('rateLimit.logout.userWindowSeconds') ??
        3600,
      ExceptionCodes.RATE_LIMIT_EXCEEDED_LOGOUT,
    );
  }
}
