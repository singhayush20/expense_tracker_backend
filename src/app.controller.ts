import { Controller, Get, Inject } from '@nestjs/common';
import { AppService } from './app.service';
import { LoggerServiceImpl } from './logger/logger.service';

@Controller()
export class AppController {
  private readonly logger = LoggerServiceImpl.createControllerLogger(
    AppController.name,
  );

  constructor(
    private readonly appService: AppService,
    @Inject('LOGGER') private readonly injectedLogger: LoggerServiceImpl,
  ) {}

  @Get()
  getHello(): string {
    this.logger.log('GET / endpoint called');
    this.injectedLogger.log('Injected logger also works');
    return this.appService.getHello();
  }
}
