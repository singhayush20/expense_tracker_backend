import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
  public readonly code: string;

  constructor(code: string, message: string, status: HttpStatus) {
    super(
      {
        code,
        message,
        timestamp: new Date().toISOString(),
      },
      status,
    );
    this.code = code;
  }
}
