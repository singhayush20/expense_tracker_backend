import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';

import express from 'express';
import { EmailLoginDto } from '../dto/email-login-request.dto';
import { EmailRegisterDto } from '../dto/email-signup-request.dto';
import { GoogleSignInDto } from '../dto/google-signin.dto';
import { RefreshTokenGuard } from '../guards/refresh-token.guard';
import { AuthService } from '../service/auth/auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('email/register')
  registerWithEmail(
    @Body() dto: EmailRegisterDto,
    @Req() request: express.Request,
  ) {
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
  loginWithEmail(@Body() dto: EmailLoginDto, @Req() request: express.Request) {
    return this.authService.loginWithEmail(dto.email, dto.password, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post('google')
  loginWithGoogle(
    @Body() dto: GoogleSignInDto,
    @Req() request: express.Request,
  ) {
    return this.authService.loginWithGoogle(dto.idToken, {
      deviceId: dto.deviceId,
      deviceName: dto.deviceName,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post('refresh')
  @UseGuards(RefreshTokenGuard)
  refresh(@Req() request: express.Request) {
    return this.authService.refresh(request.session!);
  }

  @Post('logout')
  @UseGuards(RefreshTokenGuard)
  async logout(@Req() request: express.Request) {
    await this.authService.logout(request.session!.id);

    return {
      success: true,
    };
  }
}
