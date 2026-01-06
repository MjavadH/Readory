import {Injectable, Inject, ConflictException, BadRequestException} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
    constructor(
        private prisma: PrismaService,
        @Inject('REDIS_CLIENT') private readonly redis: Redis
    ) {}

    async updateLastLogin(userId: number) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { lastLoginAt: new Date() }
        });
    }

    async getUsersStats() {
        const CACHE_KEY = 'stats:users';

        const cached = await this.redis.get(CACHE_KEY);
        if (cached) return JSON.parse(cached);

        const now = new Date();
        const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));
        const thirtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 30));

        const [totalUsers, newUsers, activeUsers] = await Promise.all([
            this.prisma.user.count(),

            this.prisma.user.count({
                where: { createdAt: { gte: sevenDaysAgo } }
            }),

            this.prisma.user.count({
                where: { lastLoginAt: { gte: thirtyDaysAgo } }
            })
        ]);

        const stats = { totalUsers, newUsers, activeUsers };

        await this.redis.set(CACHE_KEY, JSON.stringify(stats), 'EX', 3600);

        return stats;
    }

    async findAll(page: number, limit: number, search?: string, roleName?: string) {
        const skip = (page - 1) * limit
        const where: Prisma.UserWhereInput = {};
        if (search) {
            where.OR = [
                { username: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (roleName) {
            where.role = {
                name: roleName as any
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
                omit: { passwordHash: true }
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
                            orderBy: { createdAt: 'desc' }
                        }
                    }
                },
                BookAccess: {
                    include: {
                        book: {
                            select: { title: true, price: true }
                        }
                    },
                    orderBy: { purchasedAt: 'desc' }
                },
                accessRecords: {
                    where: { kind: 'CHAPTER' },
                    take: 50,
                    orderBy: { purchasedAt: 'desc' },
                    include: {
                        chapter: {
                            select: {
                                id: true,
                                title: true,
                                price: true,
                                book: { select: { title: true } }
                            }
                        }
                    }
                }
            },
        });

        if (!user) return null;
        const { passwordHash, ...result } = user;
        return result;
    }

    async findUserByIdentifier(identifier: string) {
        return this.prisma.user.findFirst({
            where: {
                OR: [
                    { email: identifier },
                    { username: identifier }
                ]
            },
            include: { role: true }
        });
    }

    async findById(id: number) {
        return this.prisma.user.findUnique({
            where: { id },
            include: { role: true },
        });
    }

    async registerTemporaryUser(email: string, username: string, passwordHash: string) {
        const existingUser = await this.prisma.user.findFirst({
            where: { OR: [{ email }, { username }] }
        });

        if (existingUser) {
            if (existingUser.email === email) throw new ConflictException('Email already exists');
            if (existingUser.username === username) throw new ConflictException('Username already taken');
        }
        const verificationCode = crypto.randomInt(100000, 999999).toString();
        const redisKey = `temp_reg:${email}`;

        if (await this.redis.get(redisKey)) {
            throw new BadRequestException('Verification code already sent. Please wait.');
        }

        const tempData = { email, username, passwordHash, verificationCode };
        await this.redis.set(redisKey, JSON.stringify(tempData), 'EX', 120);

        // TODO: Send email
        console.log(`[MOCK EMAIL] Verification code for ${email}: ${verificationCode}`);

        return { message: 'Verification code sent. Please confirm your email.', tempEmail: email };
    }

    async verifyAndCreateUser(email: string, code: string) {
        const redisKey = `temp_reg:${email}`;

        const dataString = await this.redis.get(redisKey);
        if (!dataString) {
            throw new BadRequestException('Verification code expired or invalid.');
        }

        const data = JSON.parse(dataString);
        if (data.verificationCode !== code) {
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
                username: data.username,
                passwordHash: data.passwordHash,
                roleId: role.id,
                wallet: { create: { balance: 0 } },
            },
        });

        await this.redis.del(redisKey);
        await this.redis.del('stats:users');

        return newUser;
    }

    async setBanStatus(userId: number, isBanned: boolean) {
        const updated = await this.prisma.user.update({
            where: { id: userId },
            data: { isBanned }
        });

        await this.redis.del(`session:user:${userId}`);

        return updated;
    }

    async updateRole(userId: number, roleName: 'ADMIN' | 'USER') {
        const role = await this.prisma.role.findUnique({ where: { name: roleName } });
        if (!role) throw new BadRequestException('Role not found');

        const updated = await this.prisma.user.update({
            where: { id: userId },
            data: { roleId: role.id }
        });

        await this.redis.del(`session:user:${userId}`);

        return updated;
    }

    async updatePermissions(userId: number, permissions: string[]) {
        await this.redis.del(`session:user:${userId}`);

        return this.prisma.user.update({
            where: { id: userId },
            data: { permissions }
        });
    }
}
