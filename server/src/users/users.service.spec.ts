import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheManager } from '../cache/cache.manager';
import * as argon2 from 'argon2';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: Record<string, any>;
  let cacheManager: Record<string, any>;

  beforeEach(async () => {
    prisma = {
      user: {
        update: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      },
      role: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
      },
      wallet: {},
    };

    cacheManager = {
      getString: jest.fn().mockResolvedValue(null),
      setString: jest.fn(),
      del: jest.fn(),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheManager, useValue: cacheManager },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateLastLogin', () => {
    it('updates the lastLoginAt field', async () => {
      prisma.user.update.mockResolvedValue({});
      await service.updateLastLogin(1);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { lastLoginAt: expect.any(Date) },
      });
    });
  });

  describe('getUsersStats', () => {
    it('returns cached stats when available', async () => {
      const stats = { totalUsers: 10, newUsers: 2, activeUsers: 5 };
      cacheManager.getString.mockResolvedValue(JSON.stringify(stats));

      const result = await service.getUsersStats();

      expect(result).toEqual(stats);
      expect(prisma.user.count).not.toHaveBeenCalled();
    });

    it('fetches from DB and caches when no cache hit', async () => {
      cacheManager.getString.mockResolvedValue(null);
      prisma.user.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(50);

      const result = await service.getUsersStats();

      expect(result).toEqual({ totalUsers: 100, newUsers: 5, activeUsers: 50 });
      expect(cacheManager.setString).toHaveBeenCalledWith(
        'stats:users',
        expect.any(String),
        3600,
      );
    });
  });

  describe('findAll', () => {
    it('returns paginated users', async () => {
      const users = [{ id: 1, email: 'a@b.com' }];
      prisma.user.findMany.mockResolvedValue(users);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.findAll(1, 10);

      expect(result).toEqual({ users, total: 1 });
    });

    it('applies search filter', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll(1, 10, 'john');

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { username: { contains: 'john', mode: 'insensitive' } },
              { email: { contains: 'john', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });

    it('applies role filter', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      await service.findAll(1, 10, undefined, 'ADMIN');

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: { name: 'ADMIN' } },
        }),
      );
    });
  });

  describe('findOneWithDetails', () => {
    it('returns user without passwordHash', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'a@b.com',
        passwordHash: 'secret',
        role: { name: 'USER' },
        wallet: null,
        accessRecords: [],
      });

      const result = await service.findOneWithDetails(1);

      expect(result).not.toHaveProperty('passwordHash');
      expect(result).toHaveProperty('email', 'a@b.com');
    });

    it('returns null when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const result = await service.findOneWithDetails(99);
      expect(result).toBeNull();
    });
  });

  describe('findUserByIdentifier', () => {
    it('searches by email or username', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 1 });
      await service.findUserByIdentifier('test@test.com');
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { OR: [{ email: 'test@test.com' }, { username: 'test@test.com' }] },
        include: { role: true },
      });
    });
  });

  describe('findById', () => {
    it('returns user with role and wallet', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1 });
      const result = await service.findById(1);
      expect(result).toEqual({ id: 1 });
    });
  });

  describe('registerTemporaryUser', () => {
    it('throws ConflictException when email exists', async () => {
      prisma.user.findFirst.mockResolvedValue({ email: 'a@b.com', username: 'other' });
      await expect(service.registerTemporaryUser('a@b.com', 'user', 'hash')).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when username exists (case-insensitive)', async () => {
      prisma.user.findFirst.mockResolvedValue({ email: 'other@b.com', username: 'user' });
      await expect(service.registerTemporaryUser('new@b.com', 'User', 'hash')).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException when code already sent', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      cacheManager.getString.mockResolvedValue('existing');

      await expect(service.registerTemporaryUser('a@b.com', 'user', 'hash')).rejects.toThrow(BadRequestException);
    });

    it('stores temp data in cache and returns message', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const result = await service.registerTemporaryUser('a@b.com', 'user', 'hash');

      expect(result.message).toContain('Verification code sent');
      expect(result.tempEmail).toBe('a@b.com');
      expect(cacheManager.setString).toHaveBeenCalled();
    });
  });

  describe('verifyAndCreateUser', () => {
    it('throws BadRequestException when no data in cache', async () => {
      cacheManager.getString.mockResolvedValue(null);
      await expect(service.verifyAndCreateUser('a@b.com', '123456')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException on wrong code', async () => {
      cacheManager.getString.mockResolvedValue(JSON.stringify({ verificationCode: '999999' }));
      cacheManager.incr.mockResolvedValue(1);
      await expect(service.verifyAndCreateUser('a@b.com', '000000')).rejects.toThrow(BadRequestException);
    });

    it('throws and clears cache after 5 wrong attempts', async () => {
      cacheManager.getString.mockResolvedValue(JSON.stringify({ verificationCode: '999999' }));
      cacheManager.incr.mockResolvedValue(5);
      await expect(service.verifyAndCreateUser('a@b.com', '000000')).rejects.toThrow('Too many invalid attempts');
      expect(cacheManager.del).toHaveBeenCalledWith('temp_reg:a@b.com');
    });

    it('creates user on correct code', async () => {
      const tempData = { email: 'a@b.com', username: 'user', passwordHash: 'hash', verificationCode: '123456' };
      cacheManager.getString.mockResolvedValue(JSON.stringify(tempData));
      prisma.role.upsert.mockResolvedValue({ id: 1, name: 'USER' });
      prisma.user.create.mockResolvedValue({ id: 1, email: 'a@b.com', username: 'user' });

      const result = await service.verifyAndCreateUser('a@b.com', '123456');

      expect(result.email).toBe('a@b.com');
      expect(cacheManager.del).toHaveBeenCalledWith('stats:users');
    });
  });

  describe('setBanStatus', () => {
    it('bans user and clears session cache', async () => {
      prisma.user.update.mockResolvedValue({ id: 1, isBanned: true });
      const result = await service.setBanStatus(1, true);
      expect(result.isBanned).toBe(true);
      expect(cacheManager.del).toHaveBeenCalledWith('session:user:1');
    });
  });

  describe('updateRole', () => {
    it('throws BadRequestException when role not found', async () => {
      prisma.role.findUnique.mockResolvedValue(null);
      await expect(service.updateRole(1, 'ADMIN')).rejects.toThrow(BadRequestException);
    });

    it('updates role and clears cache', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 2, name: 'ADMIN' });
      prisma.user.update.mockResolvedValue({ id: 1, roleId: 2 });

      const result = await service.updateRole(1, 'ADMIN');

      expect(result.roleId).toBe(2);
      expect(cacheManager.del).toHaveBeenCalledWith('session:user:1');
    });
  });

  describe('updatePermissions', () => {
    it('updates permissions and clears cache', async () => {
      prisma.user.update.mockResolvedValue({ id: 1, permissions: ['MANAGE_BOOKS'] });
      const result = await service.updatePermissions(1, ['MANAGE_BOOKS']);
      expect(result.permissions).toEqual(['MANAGE_BOOKS']);
      expect(cacheManager.del).toHaveBeenCalledWith('session:user:1');
    });
  });

  describe('updateUser', () => {
    it('throws NotFoundException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.updateUser(1, { username: 'new' })).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when nothing to update', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, passwordHash: 'hash' });
      await expect(service.updateUser(1, {})).rejects.toThrow(BadRequestException);
    });

    it('validates username length', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, passwordHash: 'hash' });
      await expect(service.updateUser(1, { username: 'ab' })).rejects.toThrow('Username must be 3-32 characters');
    });

    it('validates username characters', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, passwordHash: 'hash' });
      await expect(service.updateUser(1, { username: 'invalid user!' })).rejects.toThrow('Username contains invalid characters');
    });

    it('throws ConflictException when username taken', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, passwordHash: 'hash' });
      prisma.user.findFirst.mockResolvedValue({ id: 2 });
      await expect(service.updateUser(1, { username: 'taken' })).rejects.toThrow(ConflictException);
    });

    it('updates username successfully', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, passwordHash: 'hash' });
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.update.mockResolvedValue({ id: 1, email: 'a@b.com', username: 'newname', updatedAt: new Date() });

      const result = await service.updateUser(1, { username: 'NewName' });

      expect(result.success).toBe(true);
      expect(cacheManager.del).toHaveBeenCalledWith('session:user:1');
    });

    it('requires currentPassword to change password', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 1, passwordHash: 'hash' });
      await expect(service.updateUser(1, { newPassword: 'newpass123' })).rejects.toThrow(
        'currentPassword is required',
      );
    });

    it('rejects incorrect current password', async () => {
      const hash = await argon2.hash('correct');
      prisma.user.findUnique.mockResolvedValue({ id: 1, passwordHash: hash });
      await expect(
        service.updateUser(1, { currentPassword: 'wrong', newPassword: 'newpass123' }),
      ).rejects.toThrow('Current password is incorrect');
    });

    it('rejects short new password', async () => {
      const hash = await argon2.hash('correct');
      prisma.user.findUnique.mockResolvedValue({ id: 1, passwordHash: hash });
      await expect(
        service.updateUser(1, { currentPassword: 'correct', newPassword: 'short' }),
      ).rejects.toThrow('New password must be at least 8 characters');
    });

    it('updates password successfully', async () => {
      const hash = await argon2.hash('correct');
      prisma.user.findUnique.mockResolvedValue({ id: 1, passwordHash: hash });
      prisma.user.update.mockResolvedValue({ id: 1, email: 'a@b.com', username: 'user', updatedAt: new Date() });

      const result = await service.updateUser(1, { currentPassword: 'correct', newPassword: 'newpass1234' });

      expect(result.success).toBe(true);
    });
  });
});
