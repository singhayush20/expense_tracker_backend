import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Session } from '../entity';
import {
  EmailLoginDto,
  EmailRegisterDto,
  GoogleSignInDto,
  LoginResponseDto,
  RefreshResponseDto,
  LogoutResponseDto,
  VerifyEmailDto,
  ResendVerificationDto,
  EmailRegisterResponseDto,
} from '../dto';
import { AuthSession } from '../decorators/auth-session.decorator';
import { RefreshTokenGuard } from '../guards/refresh-token.guard';
import { AuthService } from '../service/auth/auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('email/register')
  registerWithEmail(
    @Body() dto: EmailRegisterDto,
    @Req() request: Request,
  ): Promise<EmailRegisterResponseDto> {
    return this.authService.registerWithEmail(
      dto.email,
      dto.password,
      dto.displayName,
      request.ip,
    );
  }

  @Post('email/verify')
  verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Req() request: Request,
  ): Promise<LoginResponseDto> {
    return this.authService.verifyEmail(
      dto.email,
      dto.otp,
      {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      },
      request.ip,
    );
  }

  @Post('email/resend-verification')
  async resendVerificationEmail(
    @Body() dto: ResendVerificationDto,
    @Req() request: Request,
  ): Promise<{ success: true }> {
    await this.authService.resendVerificationEmail(dto.email, request.ip);

    return {
      success: true,
    };
  }

  @Post('email/login')
  loginWithEmail(
    @Body() dto: EmailLoginDto,
    @Req() request: Request,
  ): Promise<LoginResponseDto> {
    return this.authService.loginWithEmail(
      dto.email,
      dto.password,
      {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      },
      request.ip,
    );
  }

  @Post('google')
  loginWithGoogle(
    @Body() dto: GoogleSignInDto,
    @Req() request: Request,
  ): Promise<LoginResponseDto> {
    return this.authService.loginWithGoogle(dto.idToken, {
      deviceId: dto.deviceId,
      deviceName: dto.deviceName,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post('refresh')
  @UseGuards(RefreshTokenGuard)
  refresh(@AuthSession() session: Session): Promise<RefreshResponseDto> {
    return this.authService.refresh(session);
  }

  @Post('logout')
  @UseGuards(RefreshTokenGuard)
  async logout(@AuthSession() session: Session): Promise<LogoutResponseDto> {
    await this.authService.logout(session.id);

    return {
      success: true,
    };
  }
}
