import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { WalletsModule } from './wallets/wallets.module';
import { BooksModule } from './books/books.module';
import { ChaptersModule } from './chapters/chapters.module';
import { MediaModule } from './media/media.module';
import { RedisModule } from './redis/redis.module';
import { CacheModule } from './cache/cache.module';
import { GenresModule } from './genre/genres.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PublicModule } from './public/public.module';
import { BookTypesModule } from './book-types/book-types.module';
import { StorageModule } from './storage/storage.module';
import { ReaderModule } from './reader/reader.module';
import { MailModule } from './mail/mail.module';
import { ContributorModule } from './contributor/contributor.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { ScheduledPublishingModule } from './scheduled-publishing/scheduled-publishing.module';
import { PaymentsModule } from './payments/payments.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { CollectionsModule } from './collections/collections.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ScheduleModule } from '@nestjs/schedule';
import { SearchModule } from './search/search.module';
import { BookMaintenanceModule } from './book-maintenance/book-maintenance.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL_MS || 60000),
        limit: Number(process.env.THROTTLE_LIMIT || 120),
      },
    ]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST') || '127.0.0.1',
          port: configService.get<number>('REDIS_PORT') || 6379,
          maxRetriesPerRequest: null,
        },

        prefix: 'readory',
      }),
    }),
    ScheduleModule.forRoot(),
    RedisModule,
    RateLimitModule,
    CacheModule,
    PrismaModule,
    UsersModule,
    AuthModule,
    WalletsModule,
    BooksModule,
    ChaptersModule,
    MediaModule,
    GenresModule,
    DashboardModule,
    PublicModule,
    BookTypesModule,
    StorageModule,
    ReaderModule,
    MailModule,
    ContributorModule,
    AuditLogModule,
    ScheduledPublishingModule,
    PaymentsModule,
    CollectionsModule,
    NotificationsModule,
    SearchModule,
    BookMaintenanceModule,
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
