import { HttpStatus, Injectable } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { GoogleUser } from '../../dto';
import { AppException } from '../../../../exceptionn-handling/app-exception';
import { ExceptionCodes } from '../../../../exceptionn-handling/exception-codes';

@Injectable()
export class GoogleAuthService {
  private readonly client: OAuth2Client;
  private readonly clientIds: string[];

  constructor(private readonly configService: ConfigService) {
    this.client = new OAuth2Client();

    const androidClientId = this.configService.get<string>(
      'googleOAuth.androidClientId',
    );

    this.clientIds = [androidClientId].filter((value): value is string =>
      Boolean(value),
    );

    if (this.clientIds.length === 0) {
      throw new Error('No Google OAuth client IDs configured');
    }
  }

  async verifyIdToken(idToken: string): Promise<GoogleUser> {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientIds,
      });

      const payload = ticket.getPayload();

      if (!payload) {
        throw new AppException(
          ExceptionCodes.GOOGLE_VERIFICATION_FAILED,
          'Invalid Google token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      return {
        subject: payload.sub,
        email: payload.email!,
        emailVerified: payload.email_verified ?? false,
        displayName: payload.name ?? null,
        avatarUrl: payload.picture ?? null,
      };
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }

      throw new AppException(
        ExceptionCodes.GOOGLE_VERIFICATION_FAILED,
        'Google authentication failed',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }
}
