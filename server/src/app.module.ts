import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { WalletsModule } from './wallets/wallets.module';
import { BooksModule } from './books/books.module';
import { ChaptersModule } from './chapters/chapters.module';
import { MediaModule } from './media/media.module';
import { RedisModule } from './redis/redis.module';
import { GenresModule } from './genre/genres.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PublicModule } from './public/public.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }),
    RedisModule,
    PrismaModule,
    UsersModule,
    AuthModule,
    WalletsModule,
    BooksModule,
    ChaptersModule,
    MediaModule,
    GenresModule,
    DashboardModule,
    PublicModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
