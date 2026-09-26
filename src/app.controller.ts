import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

@Controller('app/api/v1')
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectPinoLogger(AppController.name) private readonly logger: PinoLogger,
  ) {}

  @Get('test')
  getHello(): string {
    this.logger.info('GET / endpoint called');
    return this.appService.test();
  }
}
