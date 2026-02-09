import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BookTypesModule } from '../book-types/book-types.module'

@Module({
  imports: [PrismaModule, BookTypesModule],
  controllers: [PublicController],
  providers: [PublicService],
  exports: [PublicService]
})
export class PublicModule {}
