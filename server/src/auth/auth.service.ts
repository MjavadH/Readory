import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
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
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
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

  // Validate user credentials for login
  async validateUser(identifier: string, password: string) {
    const user = await this.usersService.findUserByIdentifier(identifier);
    if (!user) {
      return null;
    }
    if (user.isBanned) {
      throw new UnauthorizedException(
        'Account is blocked. Please contact support.',
      );
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
      throw new UnauthorizedException(
        'Account is blocked. Please contact support.',
      );
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
      throw new UnauthorizedException(
        'Account is blocked. Please contact support.',
      );
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
}
