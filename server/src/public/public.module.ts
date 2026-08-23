import { forwardRef, Module } from '@nestjs/common';
import { BookTypesModule } from '../book-types/book-types.module';
import { BooksModule } from '../books/books.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  imports: [PrismaModule, BookTypesModule, DashboardModule, forwardRef(() => BooksModule)],
  controllers: [PublicController],
  providers: [PublicService],
  exports: [PublicService],
})
export class PublicModule {}
