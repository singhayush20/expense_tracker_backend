import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
import { AppException } from '../../exceptionn-handling/app-exception';
import { ExceptionCodes } from '../../exceptionn-handling/exception-codes';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter<unknown>;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.getOrThrow<string>('email.smtp.host');

    const port = this.configService.getOrThrow<number>('email.smtp.port');

    const secure =
      this.configService.get<boolean>('email.smtp.secure') ?? false;

    const user = this.configService.getOrThrow<string>('email.smtp.user');

    const password = this.configService.getOrThrow<string>(
      'email.smtp.password',
    );

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass: password,
      },
    });
  }

  async sendEmailVerificationOtp(email: string, otp: string): Promise<void> {
    const from = this.configService.getOrThrow<string>('email.from');

    try {
      await this.transporter.sendMail({
        from,
        to: email,
        subject: 'Verify your Expense Tracker email',
        text: `
Your Expense Tracker verification code is:

${otp}

This code expires in 10 minutes.

If you did not create an Expense Tracker account,
you can safely ignore this email.
        `.trim(),
        html: this.buildVerificationEmail(otp),
      });
    } catch (error) {
      this.logger.error(
        'Failed to send email verification OTP',
        error instanceof Error ? error.stack : undefined,
      );

      throw new AppException(
        ExceptionCodes.EMAIL_NOT_VERIFIED,
        'Unable to send verification email.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private buildVerificationEmail(otp: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <body>
          <div
            style="
              font-family: Arial, sans-serif;
              max-width: 520px;
              margin: auto;
            "
          >
            <h2>Verify your email</h2>

            <p>
              Use the following verification code
              to verify your Expense Tracker account:
            </p>

            <div
              style="
                font-size: 32px;
                font-weight: bold;
                letter-spacing: 8px;
                margin: 24px 0;
              "
            >
              ${otp}
            </div>

            <p>
              This code expires in
              <strong>10 minutes</strong>.
            </p>

            <p>
              If you did not create this account,
              you can safely ignore this email.
            </p>
          </div>
        </body>
      </html>
    `;
  }
}
