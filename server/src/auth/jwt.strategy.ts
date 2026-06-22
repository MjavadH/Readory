import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CacheManager } from '../cache/cache.manager';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        configService: ConfigService,
        private prisma: PrismaService,
        private readonly cacheManager: CacheManager
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
        const cacheKey = `session:user:${userId}`;
        const cachedUser = await this.cacheManager.getString(cacheKey);
        if (cachedUser) {
            const user = JSON.parse(cachedUser);
            if (user.isBanned) throw new UnauthorizedException('Account suspended.');
            return user;
        }

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { role: true }
        });

        if (!user) throw new UnauthorizedException('User not found');
        if (user.isBanned) throw new UnauthorizedException('Account suspended.');

        const sessionUser: {
            userId: number;
            username: string;
            roleName?: "ADMIN";
            permissions?: string[];
        } = {
            userId: user.id,
            username: user.username,
        };

        if (user.role?.name === "ADMIN") {
            sessionUser.roleName = "ADMIN";
            sessionUser.permissions = user.permissions || [];
        }

        await this.cacheManager.setString(cacheKey, JSON.stringify(sessionUser), 1800);

        return sessionUser
    }
}
