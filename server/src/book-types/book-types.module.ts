import { Module } from '@nestjs/common';
import { BookTypesService } from './book-types.service';
import { BookTypesController } from './book-types.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [BookTypesService],
  controllers: [BookTypesController],
  exports: [BookTypesService],
})
export class BookTypesModule {}
