import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { UsersService } from '../users/users.service';
import * as argon2 from 'argon2';
import { CacheManager } from '../cache/cache.manager';
import { MailService } from '../mail/mail.service';
import { createHash, randomBytes } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { GoogleAvatarService } from './google-avatar.service';
import { SessionService } from './sessions/session.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

type UserWithRoleAndWallet = {
  id: number;
  email: string;
  username: string;
  isBanned: boolean;
  permissions: string[];
  role: { name: 'ADMIN' | 'USER' } | null;
  wallet: { balance: unknown } | null;
  avatarKey?: string | null;
};

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client();

  constructor(
    private usersService: UsersService,
    private cacheManager: CacheManager,
    private mailService: MailService,
    private googleAvatarService: GoogleAvatarService,
    private sessionService: SessionService,
    private prisma: PrismaService,
  ) {}

  private toSafeProfile(user: UserWithRoleAndWallet) {
    const baseProfile: {
      id: number;
      userId: number;
      email: string;
      username: string;
      walletBalance: number;
      roleName?: 'ADMIN';
      permissions?: string[];
      avatarKey?: string | null;
    } = {
      id: user.id,
      userId: user.id,
      email: user.email,
      username: user.username,
      walletBalance: Number(user.wallet?.balance ?? 0),
      avatarKey: user.avatarKey ?? null,
    };

    if (user.role?.name === 'ADMIN') {
      baseProfile.roleName = 'ADMIN';
      baseProfile.permissions = user.permissions || [];
    }

    return baseProfile;
  }

  private hashResetToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  // Validate user credentials for login
  async validateUser(identifier: string, password: string) {
    const user = await this.usersService.findUserByIdentifier(identifier);
    if (!user) {
      return null;
    }
    if (user.isBanned) {
      throw new UnauthorizedException('Account is blocked. Please contact support.');
    }
    const isValid = await argon2.verify(user.passwordHash, password);
    if (!isValid) {
      return null;
    }
    return user;
  }

  async verifyEmail(email: string, otp: string, req: Request, res: Response) {
    const createdUser = await this.usersService.verifyAndCreateUser(email, otp);
    return this.login(createdUser, req, res);
  }

  async getProfile(userId: number) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (user.isBanned) {
      throw new UnauthorizedException('Account is blocked. Please contact support.');
    }

    return this.toSafeProfile(user);
  }

  // Register a new user
  async register(email: string, username: string, password: string) {
    const hash = await argon2.hash(password);
    return this.usersService.registerTemporaryUser(email, username, hash);
  }

  async login(user: { id: number }, req: Request, res: Response) {
    const fullUser = await this.usersService.findById(user.id);
    if (!fullUser) {
      throw new Error('User not found');
    }
    if (fullUser.isBanned) {
      throw new UnauthorizedException('Account is blocked. Please contact support.');
    }

    this.usersService.updateLastLogin(fullUser.id).catch(() => {});

    return {
      access_token: await this.sessionService.createLoginSession(fullUser, req, res),
      access_token_max_age: this.sessionService.getAccessTokenMaxAgeMs(fullUser.role?.name),
      user: this.toSafeProfile(fullUser),
    };
  }

  private async verifyGoogleCredential(credential: string, nonce: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new UnauthorizedException('Google sign-in is unavailable.');
    }

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: credential,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email || !payload.email_verified) {
        throw new UnauthorizedException('Invalid Google sign-in.');
      }
      if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
        throw new UnauthorizedException('Invalid Google sign-in.');
      }
      if (payload.aud !== clientId || payload.nonce !== nonce) {
        throw new UnauthorizedException('Invalid Google sign-in.');
      }
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid Google sign-in.');
    }
  }

  async googleLogin(credential: string, nonce: string, req: Request, res: Response) {
    const payload = await this.verifyGoogleCredential(credential, nonce);
    const existingGoogleUser = await this.usersService.findByGoogleSubject(payload.sub);
    if (existingGoogleUser) {
      const session = await this.login(existingGoogleUser, req, res);
      return { ...session, created: false };
    }

    const existingEmailUser = await this.usersService.findByEmail(payload.email!);
    if (existingEmailUser) {
      if (existingEmailUser.isBanned) {
        throw new UnauthorizedException('Account is blocked. Please contact support.');
      }
      return { requiresLink: true, email: existingEmailUser.email };
    }

    const avatarBuffer = await this.googleAvatarService.fetchAvatar(payload.picture);
    const result = await this.usersService.createGoogleUser({
      email: payload.email!,
      googleSubject: payload.sub,
      name: payload.name,
      avatarBuffer,
    });
    if (result.emailExists) {
      return { requiresLink: true, email: result.user.email };
    }
    const session = await this.login(result.user, req, res);
    return { ...session, created: result.created };
  }

  async linkGoogle(
    credential: string,
    nonce: string,
    password: string,
    req: Request,
    res: Response,
  ) {
    const payload = await this.verifyGoogleCredential(credential, nonce);
    const existingGoogleUser = await this.usersService.findByGoogleSubject(payload.sub);
    if (existingGoogleUser) {
      return { ...(await this.login(existingGoogleUser, req, res)), linked: false };
    }
    const user = await this.usersService.findByEmail(payload.email!);
    if (!user) {
      throw new UnauthorizedException('Invalid Google sign-in.');
    }
    if (user.isBanned) {
      throw new UnauthorizedException('Account is blocked. Please contact support.');
    }
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('Incorrect password.');
    const avatarBuffer = await this.googleAvatarService.fetchAvatar(payload.picture);
    const linked = await this.usersService.linkGoogleSubject(user.id, payload.sub, avatarBuffer);
    return { ...(await this.login(linked, req, res)), linked: true };
  }

  async forgotPassword(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.usersService.findUserByIdentifier(normalizedEmail);

    if (!user || user.isBanned) {
      return;
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashResetToken(token);
    const tokenKey = this.cacheManager.buildKey('pwd_reset_token', tokenHash);

    await this.cacheManager.setString(tokenKey, user.id.toString(), 900);
    await this.mailService.sendPasswordResetEmail(normalizedEmail, token);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashResetToken(token);
    const tokenKey = this.cacheManager.buildKey('pwd_reset_token', tokenHash);

    const userIdStr = await this.cacheManager.getDel(tokenKey);

    if (!userIdStr) {
      throw new UnauthorizedException('Invalid or expired reset token.');
    }

    const userId = parseInt(userIdStr, 10);
    const hash = await argon2.hash(newPassword);

    const revokedSessionIds = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        await tx.user.update({ where: { id: userId }, data: { passwordHash: hash } });
        const sessions = await tx.userSession.findMany({
          where: { userId },
          select: { id: true },
        });
        await tx.userSession.deleteMany({ where: { userId } });
        return (sessions as Array<{ id: string }>).map((session) => session.id);
      },
    );

    await this.sessionService.invalidateSessionCache(revokedSessionIds);
    await this.cacheManager.del(`session:user:${userId}`);
  }

  async rotateRefreshToken(refreshToken: string | undefined, req: Request, res: Response) {
    return this.sessionService.rotateRefreshToken(refreshToken, req, res);
  }
}
