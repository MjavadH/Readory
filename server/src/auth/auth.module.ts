import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MailModule } from '../mail/mail.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleAvatarService } from './google-avatar.service';
import { GoogleOriginGuard } from './google-origin.guard';
import { JwtStrategy } from './jwt.strategy';
import { LocalStrategy } from './local.strategy';
import { AuthSecurityService } from './security/auth-security.service';
import { SessionService } from './sessions/session.service';

@Module({
  imports: [
    UsersModule,
    PrismaModule,
    MailModule,
    RateLimitModule,
    PassportModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is required');
        }
        return {
          secret,
          signOptions: {
            expiresIn: Number(configService.get<string>('JWT_EXPIRES_IN') || 3600),
          },
        };
      },
    }),
  ],
  providers: [
    AuthService,
    AuthSecurityService,
    GoogleAvatarService,
    GoogleOriginGuard,
    LocalStrategy,
    JwtStrategy,
    SessionService,
  ],
  controllers: [AuthController],
  exports: [AuthService, SessionService],
})
export class AuthModule {}
