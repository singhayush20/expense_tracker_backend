import { Injectable, Inject } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

@Injectable()
export class AppService {
  constructor(@Inject(Logger) private readonly logger: Logger) {}

  getHello(): string {
    this.logger.log('getHello called', { action: 'getHello' });
    this.logger.log({ event: 'hello_requested', endpoint: '/' });
    return 'Hello World!';
  }
}
