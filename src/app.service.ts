import { Injectable } from '@nestjs/common';
import { LoggerServiceImpl } from './logger/logger.service';

@Injectable()
export class AppService {
  private readonly logger = LoggerServiceImpl.createServiceLogger(
    AppService.name,
  );

  getHello(): string {
    this.logger.log('getHello called', { action: 'getHello' });
    this.logger.logBusinessEvent('hello_requested', { endpoint: '/' });
    return 'Hello World!';
  }
}
