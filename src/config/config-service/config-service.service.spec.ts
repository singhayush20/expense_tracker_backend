import { Test } from '@nestjs/testing';
import { ConfigServiceService } from './config-service.service';

describe('ConfigServiceService', () => {
  let service: ConfigServiceService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ConfigServiceService],
    }).compile();

    service = module.get(ConfigServiceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
