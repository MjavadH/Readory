import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { CacheManager } from '../cache/cache.manager';
import { MailService } from '../mail/mail.service';
import { createHash, randomBytes } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';

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
    private jwtService: JwtService,
    private cacheManager: CacheManager,
    private mailService: MailService,
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

  async verifyEmail(email: string, otp: string) {
    const createdUser = await this.usersService.verifyAndCreateUser(email, otp);
    return this.login(createdUser);
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

  async login(user: { id: number }) {
    const fullUser = await this.usersService.findById(user.id);
    if (!fullUser) {
      throw new Error('User not found');
    }
    if (fullUser.isBanned) {
      throw new UnauthorizedException('Account is blocked. Please contact support.');
    }

    this.usersService.updateLastLogin(fullUser.id).catch(() => {});

    const payload = {
      sub: fullUser.id,
      email: fullUser.email,
      username: fullUser.username,
      roleName: fullUser.role?.name,
    };
    return {
      access_token: await this.jwtService.signAsync(payload),
      user: this.toSafeProfile(fullUser),
    };
  }

  async googleLogin(credential: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new UnauthorizedException('Google sign-in is not configured.');
    }

    let ticket;
    try {
      ticket = await this.googleClient.verifyIdToken({
        idToken: credential,
        audience: clientId,
      });
    } catch {
      throw new UnauthorizedException('Invalid Google credential.');
    }

    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified) {
      throw new UnauthorizedException('Google account email must be verified.');
    }
    if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
      throw new UnauthorizedException('Invalid Google token issuer.');
    }

    const { user, created } = await this.usersService.findOrCreateGoogleUser({
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    });
    const session = await this.login(user);

    return { ...session, created };
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

    await this.usersService.updatePassword(userId, hash);
  }
}
