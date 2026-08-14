import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheManager } from '../cache/cache.manager';
import { Prisma } from '@prisma/client';
import type { RoleName } from '@prisma/client';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { MailService } from '../mail/mail.service';
import { CollectionsService } from '../collections/collections.service';
import { StorageService } from '../storage/storage.service';
import { AvatarService } from './avatar.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private readonly cacheManager: CacheManager,
    private mailService: MailService,
    private readonly collectionsService: CollectionsService,
    private readonly storage: StorageService,
    private readonly avatarService: AvatarService,
  ) {}

  private async revokeAllUserSessions(userId: number) {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId },
      select: { id: true },
    });
    await this.prisma.userSession.deleteMany({ where: { userId } });
    await Promise.all(
      (sessions as Array<{ id: string }>).map((session) =>
        this.cacheManager.del(this.cacheManager.buildKey('auth:session', session.id)),
      ),
    );
    await this.cacheManager.del(`session:user:${userId}`);
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private normalizeUsername(username: string) {
    return username
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_');
  }

  buildUsernameCandidate(name: string | null | undefined, email: string, attempt: number) {
    const localPart = email.split('@')[0] || 'reader';
    const base =
      this.normalizeUsername(name || localPart)
        .replace(/^_+|_+$/g, '')
        .slice(0, 16) || 'reader';
    const suffix = attempt === 0 ? '' : crypto.randomInt(1000, 999999).toString();
    return `${base}${suffix}`.slice(0, 20);
  }

  private isUniqueViolation(error: unknown, field?: string) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      return false;
    }
    const target = (error.meta?.target as string[] | string | undefined) ?? [];
    return !field || String(target).includes(field);
  }

  getAvatarUrl(avatarKey?: string | null) {
    return avatarKey ? this.storage.getPublicUrl(avatarKey) : null;
  }

  async updateLastLogin(userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  async getUsersStats() {
    const CACHE_KEY = 'stats:users';

    const cached = await this.cacheManager.getString(CACHE_KEY);
    if (cached) return JSON.parse(cached);

    const now = new Date();
    const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));
    const thirtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 30));

    const [totalUsers, newUsers, activeUsers] = await Promise.all([
      this.prisma.user.count(),

      this.prisma.user.count({
        where: { createdAt: { gte: sevenDaysAgo } },
      }),

      this.prisma.user.count({
        where: { lastLoginAt: { gte: thirtyDaysAgo } },
      }),
    ]);

    const stats = { totalUsers, newUsers, activeUsers };

    await this.cacheManager.setString(CACHE_KEY, JSON.stringify(stats), 3600);

    return stats;
  }

  async findAll(page: number, limit: number, search?: string, roleName?: string) {
    const skip = (page - 1) * limit;
    const where: Prisma.UserWhereInput = {};
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (roleName) {
      where.role = {
        name: roleName as RoleName,
      };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          role: true,
          wallet: true,
        },
        omit: { passwordHash: true },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { users, total };
  }

  async findOneWithDetails(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        wallet: {
          include: {
            transactions: {
              take: 50,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        accessRecords: {
          take: 50,
          orderBy: { purchasedAt: 'desc' },
          include: {
            chapter: {
              select: {
                id: true,
                title: true,
                price: true,
                book: { select: { title: true } },
              },
            },
          },
        },
      },
    });

    if (!user) return null;
    const { passwordHash, ...result } = user;
    return result;
  }

  async findUserByIdentifier(identifier: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
      include: { role: true },
    });
  }

  async findById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { role: true, wallet: true },
    });
  }

  async registerTemporaryUser(email: string, username: string, passwordHash: string) {
    const existingUser = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existingUser) {
      if (existingUser.email === email) throw new ConflictException('Email already exists');
      if (existingUser.username.toLowerCase() === username.toLowerCase())
        throw new ConflictException('Username already taken');
    }
    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const redisKey = `temp_reg:${email}`;

    if (await this.cacheManager.getString(redisKey)) {
      throw new BadRequestException('Verification code already sent. Please wait.');
    }

    const tempData = { email, username, passwordHash, verificationCode };
    await this.cacheManager.setString(redisKey, JSON.stringify(tempData), 120);

    await this.mailService.sendUserConfirmation(email, username, verificationCode);

    return { message: 'Verification code sent. Please confirm your email.', tempEmail: email };
  }

  async verifyAndCreateUser(email: string, code: string) {
    const redisKey = `temp_reg:${email}`;
    const attemptKey = `temp_reg_attempts:${email}`;

    const dataString = await this.cacheManager.getString(redisKey);
    if (!dataString) {
      throw new BadRequestException('Verification code expired or invalid.');
    }

    const data = JSON.parse(dataString);
    if (data.verificationCode !== code) {
      const attempts = await this.cacheManager.incr(attemptKey);
      if (attempts === 1) {
        await this.cacheManager.expire(attemptKey, 120);
      }
      if (attempts >= 5) {
        await this.cacheManager.del(redisKey);
        await this.cacheManager.del(attemptKey);
        throw new BadRequestException('Too many invalid attempts. Please register again.');
      }
      throw new BadRequestException('Invalid verification code.');
    }

    const role = await this.prisma.role.upsert({
      where: { name: 'USER' },
      update: {},
      create: { name: 'USER' },
    });

    const newUser = await this.prisma.user.create({
      data: {
        email: data.email,
        username: data.username.toLowerCase(),
        passwordHash: data.passwordHash,
        roleId: role.id,
        wallet: { create: { balance: 0 } },
      },
    });

    await this.collectionsService.ensureFavoritesCollection(newUser.id);

    await this.cacheManager.del(redisKey);
    await this.cacheManager.del(attemptKey);

    const statsCache = await this.cacheManager.getString('stats:users');
    if (statsCache) {
      try {
        const stats = JSON.parse(statsCache);
        stats.totalUsers += 1;
        stats.newUsers += 1;
        await this.cacheManager.setString('stats:users', JSON.stringify(stats), 3600);
      } catch {
        await this.cacheManager.del('stats:users');
      }
    }

    return newUser;
  }

  async findByGoogleSubject(googleSubject: string) {
    return this.prisma.user.findUnique({
      where: { googleSubject },
      include: { role: true, wallet: true },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(email) },
      include: { role: true, wallet: true },
    });
  }

  async createGoogleUser(input: {
    email: string;
    googleSubject: string;
    name?: string | null;
    avatarBuffer?: Buffer | null;
  }) {
    const email = this.normalizeEmail(input.email);
    const role = await this.prisma.role.upsert({
      where: { name: 'USER' as RoleName },
      update: {},
      create: { name: 'USER' as RoleName },
    });
    const passwordHash = await argon2.hash(crypto.randomBytes(48).toString('base64url'));

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const username = this.buildUsernameCandidate(input.name, email, attempt);
      try {
        const user = await this.prisma.$transaction(async (tx) => {
          const created = await tx.user.create({
            data: {
              email,
              username,
              passwordHash,
              googleSubject: input.googleSubject,
              roleId: role.id,
              wallet: { create: { balance: 0 } },
            },
            include: { role: true, wallet: true },
          });
          await this.collectionsService.ensureFavoritesCollection(created.id, tx);
          return created;
        });
        if (input.avatarBuffer) {
          this.storeGoogleAvatar(user.id, input.avatarBuffer).catch(() => undefined);
        }
        await this.cacheManager.del('stats:users');
        return { user, created: true };
      } catch (error) {
        if (this.isUniqueViolation(error, 'username')) continue;
        if (this.isUniqueViolation(error, 'googleSubject')) {
          const user = await this.findByGoogleSubject(input.googleSubject);
          if (user) return { user, created: false };
        }
        if (this.isUniqueViolation(error, 'email')) {
          const user = await this.findByEmail(email);
          if (user) return { user, created: false, emailExists: true };
        }
        throw error;
      }
    }
    throw new ConflictException('Could not allocate a unique username');
  }

  async linkGoogleSubject(userId: number, googleSubject: string, avatarBuffer?: Buffer | null) {
    let updated;
    try {
      updated = await this.prisma.$transaction(async (tx) => {
        const result = await tx.user.updateMany({
          where: { id: userId, googleSubject: null },
          data: { googleSubject },
        });
        if (result.count !== 1) {
          return tx.user.findUnique({
            where: { id: userId },
            include: { role: true, wallet: true },
          });
        }
        return tx.user.findUnique({ where: { id: userId }, include: { role: true, wallet: true } });
      });
    } catch (error) {
      if (this.isUniqueViolation(error, 'googleSubject')) {
        throw new ConflictException('Google account could not be connected.');
      }
      throw error;
    }
    if (!updated) throw new NotFoundException('User not found');
    if (updated.googleSubject !== googleSubject) {
      throw new ConflictException('Google account could not be connected.');
    }
    if (avatarBuffer && !updated.avatarKey) {
      this.storeGoogleAvatar(userId, avatarBuffer).catch(() => undefined);
    }
    await this.cacheManager.del(`session:user:${userId}`);
    return updated;
  }

  private async storeGoogleAvatar(userId: number, avatarBuffer: Buffer) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarKey: true },
    });
    if (!user || user.avatarKey) return;
    const key = await this.avatarService.storeProcessedAvatar(userId, avatarBuffer);
    const updated = await this.prisma.user.updateMany({
      where: { id: userId, avatarKey: null },
      data: { avatarKey: key },
    });
    if (updated.count !== 1) await this.storage.deleteKeys([key]).catch(() => undefined);
  }

  async setBanStatus(userId: number, isBanned: boolean) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isBanned },
    });

    if (isBanned) {
      await this.revokeAllUserSessions(userId);
    }
    await this.cacheManager.del(`session:user:${userId}`);

    return updated;
  }

  async updateRole(userId: number, roleName: 'ADMIN' | 'USER') {
    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) throw new BadRequestException('Role not found');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { roleId: role.id },
    });

    await this.revokeAllUserSessions(userId);

    return updated;
  }

  async updatePermissions(userId: number, permissions: string[]) {
    await this.revokeAllUserSessions(userId);

    return this.prisma.user.update({
      where: { id: userId },
      data: { permissions },
    });
  }

  async updateUser(userId: number, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true, passwordHash: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const data: any = {};

    // username update
    if (dto.username != null) {
      const nextUsername = String(dto.username).trim().toLowerCase();

      if (nextUsername.length < 3 || nextUsername.length > 20) {
        throw new BadRequestException('Username must be 3-20 characters');
      }

      // simple safe charset (adjust to your needs)
      if (!/^[a-zA-Z0-9_]+$/.test(nextUsername)) {
        throw new BadRequestException(
          'Username can only contain letters, numbers, and underscores',
        );
      }

      const exists = await this.prisma.user.findFirst({
        where: { username: nextUsername, NOT: { id: userId } },
        select: { id: true },
      });
      if (exists) throw new ConflictException('Username already taken');

      data.username = nextUsername;
    }

    // password update
    if (dto.newPassword != null) {
      const currentPassword = dto.currentPassword;
      const newPassword = String(dto.newPassword);

      if (!currentPassword) {
        throw new BadRequestException('currentPassword is required to change password');
      }
      const ok = await argon2.verify(user.passwordHash, currentPassword);
      if (!ok) throw new BadRequestException('Current password is incorrect');

      if (newPassword.length < 8) {
        throw new BadRequestException('New password must be at least 8 characters');
      }

      data.passwordHash = await argon2.hash(newPassword);
    }

    if (dto.showMemberSince !== undefined) data.showMemberSince = dto.showMemberSince;
    if (dto.showFavorites !== undefined) data.showFavorites = dto.showFavorites;
    if (dto.showRecentRatings !== undefined) data.showRecentRatings = dto.showRecentRatings;
    if (dto.showRecentlyReading !== undefined) data.showRecentlyReading = dto.showRecentlyReading;

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Nothing to update');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        username: true,
        avatarKey: true,
        showMemberSince: true,
        showFavorites: true,
        showRecentRatings: true,
        showRecentlyReading: true,
        updatedAt: true,
      },
    });

    if (dto.username != null || dto.newPassword != null) {
      await this.revokeAllUserSessions(userId);
    } else {
      await this.cacheManager.del(`session:user:${userId}`);
    }
    await this.cacheManager.bumpVersion(`public_profile:version:${userId}`);

    return { success: true, user: { ...updated, avatarUrl: this.getAvatarUrl(updated.avatarKey) } };
  }
}
