import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

@Injectable()
export class AppService {
  constructor(
    @InjectPinoLogger(AppService.name) private readonly logger: PinoLogger,
  ) {}

  test(): string {
    this.logger.info('Test method called in AppService');
    return 'Hello World!';
  }
}
