import { Module } from '@nestjs/common';
import { ChaptersService } from './chapters.service';
import { ChaptersController } from './chapters.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletsModule } from '../wallets/wallets.module';
import { PublicModule } from '../public/public.module'

@Module({
  imports: [PrismaModule, WalletsModule, PublicModule],
  providers: [ChaptersService],
  controllers: [ChaptersController]
})
export class ChaptersModule {}
