import { Test } from '@nestjs/testing';
import { RedisService } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [RedisService],
    }).compile();

    service = module.get(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
