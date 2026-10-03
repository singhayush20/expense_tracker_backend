import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RedisService.name);

    const redisUrl = this.configService.get<string>('cache.redis.url');

    if (!redisUrl) {
      throw new Error('REDIS_URL is not configured');
    }

    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        this.logger.warn({ retryAttempt: times, delay }, 'redis reconnecting');
        return delay;
      },
    });

    this.client.on('connect', () => {
      this.logger.info('redis connected');
    });

    this.client.on('ready', () => {
      this.logger.info('redis ready');
    });

    this.client.on('error', (err: Error) => {
      this.logger.error({ err }, 'redis error');
    });

    this.client.on('close', () => {
      this.logger.warn('redis connection closed');
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy() {
    await this.client.quit();
    this.logger.info('redis client quit');
  }
}
