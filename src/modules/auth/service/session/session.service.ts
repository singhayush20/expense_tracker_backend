import { Injectable, UnauthorizedException } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '../../entity';
import { AuthTokenService } from '../auth-token/auth-token.service';
import { CreateSessionParams } from '../../dto/create-session-params.dto';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionsRepository: Repository<Session>,

    private readonly authTokenService: AuthTokenService,
    private readonly configService: ConfigService,
  ) {}

  async createSession(params: CreateSessionParams): Promise<{
    session: Session;
    refreshToken: string;
  }> {
    const refreshToken = this.authTokenService.createRefreshToken();

    const refreshTokenHash =
      this.authTokenService.hashRefreshToken(refreshToken);

    const expiresAt = new Date();

    const refreshTokenTtlSeconds = this.configService.get<number>(
      'tokens.refreshTokenExpiresInSeconds',
    );
    if (!refreshTokenTtlSeconds) {
      throw new Error('tokens.refreshTokenExpiresInSeconds is not configured');
    }
    expiresAt.setSeconds(expiresAt.getSeconds() + refreshTokenTtlSeconds);

    const session = this.sessionsRepository.create({
      userId: params.userId,
      refreshTokenHash,
      deviceId: params.deviceId ?? null,
      deviceName: params.deviceName ?? null,
      userAgent: params.userAgent ?? null,
      ipAddress: params.ipAddress ?? null,
      expiresAt,
      lastUsedAt: new Date(),
    });

    await this.sessionsRepository.save(session);

    return {
      session,
      refreshToken,
    };
  }

  async findValidSessionByRefreshToken(refreshToken: string): Promise<Session> {
    const hash = this.authTokenService.hashRefreshToken(refreshToken);

    const session = await this.sessionsRepository.findOne({
      where: {
        refreshTokenHash: hash,
      },
      relations: {
        user: true,
      },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.revokedAt) {
      throw new UnauthorizedException('Session has been revoked');
    }

    if (session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    return session;
  }

  async rotateRefreshToken(session: Session): Promise<string> {
    const refreshToken = this.authTokenService.createRefreshToken();

    session.refreshTokenHash =
      this.authTokenService.hashRefreshToken(refreshToken);

    session.lastUsedAt = new Date();

    await this.sessionsRepository.save(session);

    return refreshToken;
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.sessionsRepository.update(
      {
        id: sessionId,
      },
      {
        revokedAt: new Date(),
      },
    );
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.sessionsRepository
      .createQueryBuilder()
      .update(Session)
      .set({
        revokedAt: new Date(),
      })
      .where('user_id = :userId', { userId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }
}
