import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { EmailLoginDto } from '../dto/email-login-request.dto';
import { EmailRegisterDto } from '../dto/email-signup-request.dto';
import { GoogleSignInDto } from '../dto/google-signin.dto';
import { RefreshTokenGuard } from '../guards/refresh-token.guard';
import { AuthService } from '../service/auth/auth.service';
import { AuthSession } from '../decorators/auth-session.decorator';
import { Session } from '../entity/session.entity';
import { LoginResponseDto } from '../dto/login.response.dto';
import { RefreshResponseDto } from '../dto/refresh.response.dto';
import { LogoutResponseDto } from '../dto/logout.response.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('email/register')
  registerWithEmail(
    @Body() dto: EmailRegisterDto,
    @Req() request: Request,
  ): Promise<LoginResponseDto> {
    return this.authService.registerWithEmail(
      dto.email,
      dto.password,
      dto.displayName,
      {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      },
    );
  }

  @Post('email/login')
  loginWithEmail(
    @Body() dto: EmailLoginDto,
    @Req() request: Request,
  ): Promise<LoginResponseDto> {
    return this.authService.loginWithEmail(dto.email, dto.password, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
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
