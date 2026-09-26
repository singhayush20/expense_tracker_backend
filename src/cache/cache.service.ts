import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { RedisService } from './redis/redis.service';

@Injectable()
export class CacheService {
  constructor(
    private readonly redisService: RedisService,
    @InjectPinoLogger(CacheService.name)
    private readonly logger: PinoLogger,
  ) {}

  private get client() {
    return this.redisService.getClient();
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.client.get(key);

    if (!data) {
      this.logger.debug({ key }, 'cache miss');
      return null;
    }

    try {
      const parsed = JSON.parse(data) as T;
      this.logger.debug({ key }, 'cache hit');
      return parsed;
    } catch {
      this.logger.error({ key }, 'cache parse error, removing corrupt entry');
      await this.client.del(key);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);

    try {
      if (ttlSeconds) {
        const ttl = ttlSeconds + Math.floor(Math.random() * 30);
        await this.client.set(key, serialized, 'EX', ttl);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error: unknown) {
      this.logger.error({ key, error }, 'cache set failed');
      throw error;
    }
  }

  async setIfNotExists(
    key: string,
    value: any,
    ttlSeconds?: number,
  ): Promise<boolean> {
    const serialized = JSON.stringify(value);
    let result;

    if (ttlSeconds) {
      // add jitter to prevent stampede
      const ttl = ttlSeconds + Math.floor(Math.random() * 30);
      // atomic set with NX and EX options to ensure lock is set only if not exists and has an expiration
      result = await this.client.set(key, serialized, 'EX', ttl, 'NX');
    } else {
      result = await this.client.set(key, serialized, 'NX');
    }

    return result === 'OK';
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }
}
