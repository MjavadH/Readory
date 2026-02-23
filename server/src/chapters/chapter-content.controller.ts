import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminPermissions } from '../auth/permissions.enum';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ChapterContentService } from './chapter-content.service';

@Controller('admin/books/:bookId/chapters/:index/content')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(RoleName.ADMIN)
@RequirePermissions(AdminPermissions.MANAGE_BOOKS)
export class ChapterContentController {
  constructor(private readonly service: ChapterContentService) {}

  @Get()
  get(
    @Param('bookId', ParseIntPipe) bookId: number,
    @Param('index', ParseIntPipe) index: number,
  ) {
    return this.service.getChapterContent(bookId, index);
  }

  @Post('images')
  @UseInterceptors(
    FilesInterceptor('files', 300, { storage: multer.memoryStorage() }),
  )
  uploadImages(
    @Param('bookId', ParseIntPipe) bookId: number,
    @Param('index', ParseIntPipe) index: number,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.service.uploadImages(bookId, index, files);
  }

  @Post('text')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  uploadText(
    @Param('bookId', ParseIntPipe) bookId: number,
    @Param('index', ParseIntPipe) index: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.uploadText(bookId, index, file);
  }

  @Delete()
  remove(
    @Param('bookId', ParseIntPipe) bookId: number,
    @Param('index', ParseIntPipe) index: number,
  ) {
    return this.service.deleteContent(bookId, index);
  }
}
