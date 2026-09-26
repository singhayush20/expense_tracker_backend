import { Controller, Get, Inject } from '@nestjs/common';
import { AppService } from './app.service';
import { Logger } from 'nestjs-pino';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Inject(Logger) private readonly logger: Logger,
    @Inject(Logger) private readonly injectedLogger: Logger,
  ) {}

  @Get()
  getHello(): string {
    this.logger.log('GET / endpoint called');
    this.injectedLogger.log('Injected logger also works');
    return this.appService.getHello();
  }
}
