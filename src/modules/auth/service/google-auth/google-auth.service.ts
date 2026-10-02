import { Injectable, UnauthorizedException } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleUser {
  subject: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
  avatarUrl: string | null;
}

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
        throw new UnauthorizedException('Invalid Google ID token');
      }

      if (!payload.sub) {
        throw new UnauthorizedException('Google account has no subject');
      }

      if (!payload.email) {
        throw new UnauthorizedException('Google account has no email');
      }

      if (payload.email_verified !== true) {
        throw new UnauthorizedException('Google email is not verified');
      }

      return {
        subject: payload.sub,
        email: payload.email.toLowerCase(),
        emailVerified: payload.email_verified === true,
        displayName: payload.name ?? null,
        avatarUrl: payload.picture ?? null,
      };
    } catch {
      throw new UnauthorizedException('Invalid Google authentication');
    }
  }
}
