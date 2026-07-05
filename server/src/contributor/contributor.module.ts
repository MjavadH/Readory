import { Module } from '@nestjs/common';
import { ContributorService } from './contributor.service';
import { ContributorController } from './contributor.controller';
import {PrismaModule} from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [ContributorController],
  providers: [ContributorService],
})
export class ContributorModule {}
