import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ContributorController } from './contributor.controller';
import { ContributorService } from './contributor.service';

@Module({
  imports: [PrismaModule],
  controllers: [ContributorController],
  providers: [ContributorService],
})
export class ContributorModule {}
