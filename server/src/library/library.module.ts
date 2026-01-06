import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LibraryService } from './library.service';
import { LibraryController } from './library.controller';

@Module({
  imports: [PrismaModule],
  providers: [LibraryService],
  controllers: [LibraryController]
})
export class LibraryModule {}
