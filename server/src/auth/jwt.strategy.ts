import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import {Inject, Injectable, UnauthorizedException} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        configService: ConfigService,
        private prisma: PrismaService,
        @Inject('REDIS_CLIENT') private readonly redis: Redis
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                (request: Request) => {
                    return request?.cookies?.access_token;
                },
            ]),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('JWT_SECRET') || '', // default to empty string
        });
    }

    async validate(payload: any) {
        const userId = payload.sub;
        const cacheKey = `session:user:${userId}`;
        const cachedUser = await this.redis.get(cacheKey);
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

        const sessionUser = {
            userId: user.id,
            username: user.username,
            roleName: user.role?.name,
            permissions: user.permissions || []
        };

        await this.redis.set(cacheKey, JSON.stringify(sessionUser), 'EX', 1800);

        return sessionUser
    }
}
