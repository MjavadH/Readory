import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { CacheManager } from '../cache/cache.manager';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly cacheManager: CacheManager,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          return request?.cookies?.access_token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const userId = payload.sub;
    const sessionId = payload.sid;
    if (!sessionId) throw new UnauthorizedException('Session is required');

    const sessionKey = this.cacheManager.buildKey('auth:session', sessionId);
    const cachedSession = await this.cacheManager.getString(sessionKey);
    if (!cachedSession) throw new UnauthorizedException('Session expired');

    let session;
    try {
      session = JSON.parse(cachedSession);
    } catch {
      await this.cacheManager.del(sessionKey);
      throw new UnauthorizedException('Corrupted session data');
    }

    if (session.userId !== userId) throw new UnauthorizedException('Invalid session');
    if (session.isBanned) throw new UnauthorizedException('Account suspended.');
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      await this.cacheManager.del(sessionKey);
      throw new UnauthorizedException('Session expired');
    }

    return {
      userId: session.userId,
      username: session.username,
      sessionId,
      roleName: session.roleName === 'ADMIN' ? 'ADMIN' : undefined,
      permissions: session.roleName === 'ADMIN' ? session.permissions || [] : undefined,
    };
  }
}
