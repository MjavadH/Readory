import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheManager } from '../cache/cache.manager';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { MailService } from '../mail/mail.service';
import { CollectionsService } from '../collections/collections.service';
import { StorageService } from '../storage/storage.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private readonly cacheManager: CacheManager,
    private mailService: MailService,
    private readonly collectionsService: CollectionsService,
    private readonly storage: StorageService,
  ) {}

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
        name: roleName as any,
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

  async setBanStatus(userId: number, isBanned: boolean) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isBanned },
    });

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

    await this.cacheManager.del(`session:user:${userId}`);

    return updated;
  }

  async updatePermissions(userId: number, permissions: string[]) {
    await this.cacheManager.del(`session:user:${userId}`);

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

    // clear jwt-session cache so new username/permissions are reflected
    await Promise.all([
      this.cacheManager.del(`session:user:${userId}`),
      this.cacheManager.bumpVersion(`public_profile:version:${userId}`),
    ]);

    return { success: true, user: { ...updated, avatarUrl: this.getAvatarUrl(updated.avatarKey) } };
  }
}
