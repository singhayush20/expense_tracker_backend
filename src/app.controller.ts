import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectPinoLogger(AppController.name) private readonly logger: PinoLogger,
  ) {}

  @Get('test')
  getHello(): string {
    this.logger.info('GET /app/api/v1/test endpoint called');
    return this.appService.test();
  }
}
