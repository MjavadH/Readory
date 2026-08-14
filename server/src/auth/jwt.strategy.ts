import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { CacheManager } from '../cache/cache.manager';

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

    const session = JSON.parse(cachedSession);
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
