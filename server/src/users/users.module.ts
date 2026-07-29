import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletsModule } from '../wallets/wallets.module';
import { MailModule } from "../mail/mail.module";
import { CollectionsModule } from "../collections/collections.module";

@Module({
  imports: [PrismaModule, WalletsModule, MailModule, CollectionsModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService]
})
export class UsersModule {}
