import { Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { RedisService } from './redis/redis.service';

@Module({
  providers: [CacheService, RedisService],
  exports: [CacheService],
})
export class CacheModule {}
