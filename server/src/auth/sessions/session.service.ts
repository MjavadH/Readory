import {
  ForbiddenException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { Cron, CronExpression } from '../../common/cron.decorator';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheManager } from '../../cache/cache.manager';
import { MailService } from '../../mail/mail.service';
import { Prisma } from '@prisma/client';

type SessionRecord = { id: string };

type DashboardSessionRecord = SessionRecord & {
  deviceOs: string | null;
  deviceBrowser: string | null;
  ipAddress: string | null;
  lastActiveAt: Date;
  createdAt: Date;
};

type SessionUser = {
  id: number;
  email: string;
  username: string;
  isBanned?: boolean;
  permissions?: string[];
  role?: { name: 'ADMIN' | 'USER' } | null;
};

@Injectable()
export class SessionService implements OnModuleInit {
  private readonly deviceCookie = 'device_id';
  private readonly refreshCookie = 'refresh_token';
  private readonly quarantineMs = 48 * 60 * 60 * 1000;
  private readonly sessionKeyPrefix = 'auth:session';

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly cacheManager: CacheManager,
    private readonly mailService: MailService,
  ) {}

  private sha256(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private lifetimes(roleName?: string) {
    const admin = roleName === 'ADMIN';
    return {
      accessSeconds: Number(
        process.env[admin ? 'ADMIN_JWT_EXPIRES_IN' : 'JWT_EXPIRES_IN'] || (admin ? 900 : 3600),
      ),
      refreshSeconds: Number(
        process.env[admin ? 'ADMIN_REFRESH_TOKEN_EXPIRES_IN' : 'REFRESH_TOKEN_EXPIRES_IN'] ||
          (admin ? 12 * 3600 : 30 * 24 * 3600),
      ),
      maxDevices: Number(
        process.env[admin ? 'ADMIN_MAX_DEVICES' : 'USER_MAX_DEVICES'] || (admin ? 3 : 10),
      ),
    };
  }

  getAccessTokenMaxAgeMs(roleName?: string) {
    return this.lifetimes(roleName).accessSeconds * 1000;
  }

  private sessionCacheKey(sessionId: string) {
    return this.cacheManager.buildKey(this.sessionKeyPrefix, sessionId);
  }

  private async cacheSession(
    session: { id: string; userId: number; expiresAt: Date },
    user: SessionUser,
  ) {
    const ttlSeconds = Math.max(1, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));
    await this.cacheManager.setString(
      this.sessionCacheKey(session.id),
      JSON.stringify({
        userId: user.id,
        username: user.username,
        isBanned: Boolean(user.isBanned),
        roleName: user.role?.name,
        permissions: user.role?.name === 'ADMIN' ? user.permissions || [] : undefined,
        expiresAt: session.expiresAt.toISOString(),
      }),
      ttlSeconds,
      0,
    );
  }

  async invalidateSessionCache(sessionIds: string[]) {
    await Promise.all(sessionIds.map((id) => this.cacheManager.del(this.sessionCacheKey(id))));
  }

  private cookieOptions(maxAge: number) {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge,
    };
  }

  private requestMeta(req: Request) {
    const userAgent = req.get('user-agent') || null;
    return {
      ipAddress: (req.ip || req.socket.remoteAddress || '').slice(0, 64) || null,
      userAgent,
      deviceOs: this.parseOs(userAgent),
      deviceBrowser: this.parseBrowser(userAgent),
    };
  }

  private parseOs(ua?: string | null) {
    if (!ua) return null;
    if (/Windows/i.test(ua)) return 'Windows';
    if (/Android/i.test(ua)) return 'Android';
    if (/(iPhone|iPad|iOS)/i.test(ua)) return 'iOS';
    if (/Mac OS X/i.test(ua)) return 'macOS';
    if (/Linux/i.test(ua)) return 'Linux';
    return 'Unknown';
  }

  private parseBrowser(ua?: string | null) {
    if (!ua) return null;
    if (/Edg\//i.test(ua)) return 'Edge';
    if (/Chrome\//i.test(ua)) return 'Chrome';
    if (/Safari\//i.test(ua)) return 'Safari';
    if (/Firefox\//i.test(ua)) return 'Firefox';
    return 'Unknown';
  }

  async createLoginSession(user: SessionUser, req: Request, res: Response) {
    const roleName = user.role?.name;
    const { accessSeconds, refreshSeconds, maxDevices } = this.lifetimes(roleName);
    const cookieDeviceId = req.cookies?.[this.deviceCookie];
    const deviceId = cookieDeviceId || randomUUID();
    const refreshToken = randomBytes(64).toString('base64url');
    const refreshTokenHash = this.sha256(refreshToken);
    const expiresAt = new Date(Date.now() + refreshSeconds * 1000);
    const meta = this.requestMeta(req);

    let session;
    let isNewDevice = false;

    if (cookieDeviceId) {
      try {
        session = await this.prisma.userSession.update({
          where: { deviceId },
          data: { userId: user.id, refreshTokenHash, expiresAt, lastActiveAt: new Date(), ...meta },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          isNewDevice = true;
        } else {
          throw error;
        }
      }
    } else {
      isNewDevice = true;
    }

    if (isNewDevice) {
      try {
        session = await this.prisma.userSession.create({
          data: { userId: user.id, deviceId, refreshTokenHash, expiresAt, ...meta },
        });

        this.mailService
          .sendNewDeviceLoginEmail(user.email, user.username, meta)
          .catch(() => undefined);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          session = await this.prisma.userSession.update({
            where: { deviceId },
            data: {
              userId: user.id,
              refreshTokenHash,
              expiresAt,
              lastActiveAt: new Date(),
              ...meta,
            },
          });
        } else {
          throw error;
        }
      }
    }

    if (!session) {
      throw new Error('Failed to create user session');
    }

    await this.cacheSession(session, user);
    await this.enforceDeviceLimit(user.id, maxDevices, session.id);

    res.cookie(this.deviceCookie, deviceId, this.cookieOptions(365 * 24 * 60 * 60 * 1000));
    res.cookie(this.refreshCookie, refreshToken, this.cookieOptions(refreshSeconds * 1000));

    return this.jwtService.signAsync(
      { sub: user.id, sid: session.id, email: user.email, username: user.username, roleName },
      { expiresIn: accessSeconds },
    );
  }

  async rotateRefreshToken(refreshToken: string | undefined, req: Request, res: Response) {
    if (!refreshToken) throw new UnauthorizedException('Refresh token is required.');
    const tokenHash = this.sha256(refreshToken);

    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { user: { include: { role: true } } },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    if (session.expiresAt <= new Date() || session.user.isBanned) {
      await this.revokeAllSessions(session.userId);
      throw new UnauthorizedException('Session expired or account suspended.');
    }

    const roleName = session.user.role?.name;
    const { accessSeconds, refreshSeconds } = this.lifetimes(roleName);
    const newRefreshToken = randomBytes(64).toString('base64url');
    const newRefreshTokenHash = this.sha256(newRefreshToken);
    const expiresAt = new Date(Date.now() + refreshSeconds * 1000);
    const meta = this.requestMeta(req);

    const { count } = await this.prisma.userSession.updateMany({
      where: { id: session.id, refreshTokenHash: tokenHash },
      data: { refreshTokenHash: newRefreshTokenHash, expiresAt, lastActiveAt: new Date(), ...meta },
    });

    if (count === 0) {
      throw new UnauthorizedException('Token already rotated or session invalid.');
    }

    const updatedSession = {
      ...session,
      refreshTokenHash: newRefreshTokenHash,
      expiresAt,
      lastActiveAt: new Date(),
      ...meta,
    };
    await this.cacheSession(updatedSession, session.user);

    res.cookie(
      this.deviceCookie,
      updatedSession.deviceId,
      this.cookieOptions(365 * 24 * 60 * 60 * 1000),
    );
    res.cookie(this.refreshCookie, newRefreshToken, this.cookieOptions(refreshSeconds * 1000));

    const accessToken = await this.jwtService.signAsync(
      {
        sub: session.userId,
        sid: session.id,
        email: session.user.email,
        username: session.user.username,
        roleName,
      },
      { expiresIn: accessSeconds },
    );

    return {
      accessToken,
      accessTokenMaxAgeMs: this.getAccessTokenMaxAgeMs(roleName),
    };
  }

  async assertTrustedSession(sessionId?: string) {
    if (!sessionId) throw new ForbiddenException('Trusted device required.');
    const session = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
      select: { createdAt: true },
    });
    if (!session || Date.now() - session.createdAt.getTime() < this.quarantineMs) {
      throw new ForbiddenException(
        'This security action is unavailable on new devices for 48 hours.',
      );
    }
  }

  async listSessions(userId: number, currentSessionId?: string) {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { lastActiveAt: 'desc' },
    });
    return (sessions as DashboardSessionRecord[]).map((s) => ({
      id: s.id,
      deviceOs: s.deviceOs,
      deviceBrowser: s.deviceBrowser,
      ipAddress: s.ipAddress,
      lastActiveAt: s.lastActiveAt,
      createdAt: s.createdAt,
      isCurrentDevice: s.id === currentSessionId,
    }));
  }

  async revokeSession(userId: number, sessionId: string, currentSessionId?: string) {
    if (sessionId !== currentSessionId) await this.assertTrustedSession(currentSessionId);
    await this.prisma.userSession.deleteMany({ where: { id: sessionId, userId } });
    await this.invalidateSessionCache([sessionId]);
  }

  async revokeOtherSessions(userId: number, currentSessionId?: string) {
    await this.assertTrustedSession(currentSessionId);
    const sessions = await this.prisma.userSession.findMany({
      where: { userId, id: { not: currentSessionId } },
      select: { id: true },
    });
    await this.prisma.userSession.deleteMany({
      where: { userId, id: { not: currentSessionId } },
    });
    await this.invalidateSessionCache((sessions as SessionRecord[]).map((session) => session.id));
  }

  async revokeAllSessions(userId: number) {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId },
      select: { id: true },
    });
    await this.prisma.userSession.deleteMany({ where: { userId } });
    await this.invalidateSessionCache((sessions as SessionRecord[]).map((session) => session.id));
    await this.cacheManager.del(`session:user:${userId}`);
  }

  private async enforceDeviceLimit(userId: number, maxDevices: number, keepSessionId: string) {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId },
      orderBy: { lastActiveAt: 'asc' },
      select: { id: true },
    });
    const overflow = sessions.length - maxDevices;
    if (overflow <= 0) return;
    const evictIds = (sessions as SessionRecord[])
      .filter((s) => s.id !== keepSessionId)
      .slice(0, overflow)
      .map((s) => s.id);
    if (evictIds.length) {
      await this.prisma.userSession.deleteMany({ where: { id: { in: evictIds } } });
      await this.invalidateSessionCache(evictIds);
    }
  }

  onModuleInit() {
    setInterval(
      () => this.collectExpiredSessions().catch(() => undefined),
      24 * 60 * 60 * 1000,
    ).unref();
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async collectExpiredSessions() {
    const inactivityTimeoutSeconds = Number(
      process.env.SESSION_INACTIVITY_TIMEOUT_SECONDS || 15552000,
    );

    const inactivityCutoff = new Date(Date.now() - inactivityTimeoutSeconds * 1000);

    const batchSize = 1000;

    const hasMore = true;
    while (hasMore) {
      const expiredSessions = await this.prisma.userSession.findMany({
        where: {
          OR: [{ expiresAt: { lt: new Date() } }, { lastActiveAt: { lt: inactivityCutoff } }],
        },
        select: { id: true },
        take: batchSize,
      });

      if (!expiredSessions.length) break;

      const evictIds = (expiredSessions as SessionRecord[]).map((session) => session.id);

      await this.prisma.userSession.deleteMany({
        where: { id: { in: evictIds } },
      });

      await this.invalidateSessionCache(evictIds);
    }
  }
}
