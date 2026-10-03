import { HttpStatus, Injectable } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';
import { AppException } from '../../exceptionn-handling/app-exception';
import { ExceptionCodes } from '../../exceptionn-handling/exception-codes';

@Injectable()
export class RateLimiterService {
  constructor(private readonly cacheService: CacheService) {}

  private getRateLimitKey(prefix: string, identifier: string): string {
    return `rate_limit:${prefix}:${identifier}`;
  }

  async checkLimit(
    prefix: string,
    identifier: string,
    max: number,
    windowSeconds: number,
    exceptionCode: string = ExceptionCodes.TOO_MANY_VERIFICATION_ATTEMPTS,
  ): Promise<void> {
    const key = this.getRateLimitKey(prefix, identifier);
    const current = await this.cacheService.get<number>(key);

    if (current !== null && current >= max) {
      throw new AppException(
        exceptionCode,
        'Too many requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const newValue = (current ?? 0) + 1;
    await this.cacheService.set(key, newValue, windowSeconds);
  }

  async getCurrent(prefix: string, identifier: string): Promise<number | null> {
    const key = this.getRateLimitKey(prefix, identifier);
    return this.cacheService.get<number>(key);
  }

  async reset(prefix: string, identifier: string): Promise<void> {
    const key = this.getRateLimitKey(prefix, identifier);
    await this.cacheService.delete(key);
  }
}
