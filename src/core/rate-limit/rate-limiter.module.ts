import { Global, Module } from '@nestjs/common';
import { CacheModule } from '../../cache/cache.module';
import { RateLimiterService } from './rate-limiter.service';

@Global()
@Module({
  imports: [CacheModule],
  providers: [RateLimiterService],
  exports: [RateLimiterService],
})
export class RateLimiterModule {}
