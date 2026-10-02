// auth/services/auth-token.service.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'crypto';
import { AccessTokenPayload } from '../../dto/auth.dto';

@Injectable()
export class AuthTokenService {
  private readonly accessTokenSecret: string;
  private readonly accessTokenExpiresInSeconds: number;
  private readonly refreshTokenBytes: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    const secret = this.configService.get<string>('tokens.jwtSecretKey');

    if (!secret) {
      throw new Error('jwtSecretKey is not configured');
    }

    this.accessTokenSecret = secret;
    this.accessTokenExpiresInSeconds = this.configService.get<number>(
      'tokens.accessTokenExpiresInSeconds',
    )!;
    this.refreshTokenBytes = this.configService.get<number>(
      'tokens.refreshTokenBytes',
    )!;
  }

  async createAccessToken(
    payload: Omit<AccessTokenPayload, 'type'>,
  ): Promise<string> {
    return this.jwtService.signAsync(
      {
        ...payload,
        type: 'access',
      },
      {
        secret: this.accessTokenSecret,
        expiresIn: this.accessTokenExpiresInSeconds,
      },
    );
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        {
          secret: this.accessTokenSecret,
        },
      );

      if (payload.type !== 'access') {
        throw new UnauthorizedException('Invalid access token');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  createRefreshToken(): string {
    return randomBytes(this.refreshTokenBytes).toString('base64url');
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
