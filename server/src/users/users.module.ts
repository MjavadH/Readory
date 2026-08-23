import { Module } from '@nestjs/common';
import { CollectionsModule } from '../collections/collections.module';
import { MailModule } from '../mail/mail.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { StorageModule } from '../storage/storage.module';
import { WalletsModule } from '../wallets/wallets.module';
import { AvatarService } from './avatar.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

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
  exports: [UsersService, AvatarService],
})
export class UsersModule {}
