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
import { CacheModule } from './cache/cache.module';
import { GenresModule } from './genre/genres.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PublicModule } from './public/public.module';
import { BookTypesModule } from './book-types/book-types.module';
import { StorageModule } from './storage/storage.module';
import { ReaderModule } from './reader/reader.module';
import { MailModule } from './mail/mail.module';
import { AuthorModule } from './author/author.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule,
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
    AuthorModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
