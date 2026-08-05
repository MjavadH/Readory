import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletsModule } from '../wallets/wallets.module';
import { MailModule } from '../mail/mail.module';
import { CollectionsModule } from '../collections/collections.module';
import { StorageModule } from '../storage/storage.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { AvatarService } from './avatar.service';

@Module({
  imports: [
    PrismaModule,
    WalletsModule,
    MailModule,
    CollectionsModule,
    StorageModule,
    RateLimitModule,
  ],
  providers: [UsersService, AvatarService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
