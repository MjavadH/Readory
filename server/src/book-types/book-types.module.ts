import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BookTypesController } from './book-types.controller';
import { BookTypesService } from './book-types.service';

@Module({
  imports: [PrismaModule],
  providers: [BookTypesService],
  controllers: [BookTypesController],
  exports: [BookTypesService],
})
export class BookTypesModule {}
