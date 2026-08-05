import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GenresController } from './genres.controller';
import { GenresService } from './genres.service';
import { PublicModule } from '../public/public.module';

@Module({
  imports: [PrismaModule, PublicModule],
  controllers: [GenresController],
  providers: [GenresService],
})
export class GenresModule {}
