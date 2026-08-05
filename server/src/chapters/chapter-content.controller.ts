import {
  Body,
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
import {
  ChapterContentService,
  IMAGE_UPLOAD_MAX_FILE_BYTES,
  IMAGE_UPLOAD_MAX_FILES,
  TEXT_UPLOAD_MAX_FILE_BYTES,
} from './chapter-content.service';

const IMAGE_UPLOAD_MULTER = {
  storage: multer.memoryStorage(),
  limits: {
    files: IMAGE_UPLOAD_MAX_FILES,
    fileSize: IMAGE_UPLOAD_MAX_FILE_BYTES,
  },
};

const TEXT_UPLOAD_MULTER = {
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: TEXT_UPLOAD_MAX_FILE_BYTES,
  },
};

@Controller('admin/books/:bookId/chapters/:index/content')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(RoleName.ADMIN)
@RequirePermissions(AdminPermissions.MANAGE_BOOKS)
export class ChapterContentController {
  constructor(private readonly service: ChapterContentService) {}

  @Get()
  get(@Param('bookId', ParseIntPipe) bookId: number, @Param('index', ParseIntPipe) index: number) {
    return this.service.getChapterContent(bookId, index);
  }

  @Post('images')
  @UseInterceptors(FilesInterceptor('files', IMAGE_UPLOAD_MAX_FILES, IMAGE_UPLOAD_MULTER))
  uploadImages(
    @Param('bookId', ParseIntPipe) bookId: number,
    @Param('index', ParseIntPipe) index: number,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.service.uploadImages(bookId, index, files);
  }

  @Post('images/append')
  @UseInterceptors(FilesInterceptor('files', IMAGE_UPLOAD_MAX_FILES, IMAGE_UPLOAD_MULTER))
  appendImages(
    @Param('bookId', ParseIntPipe) bookId: number,
    @Param('index', ParseIntPipe) index: number,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.service.appendImages(bookId, index, files);
  }

  @Post('text')
  @UseInterceptors(FileInterceptor('file', TEXT_UPLOAD_MULTER))
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

  @Delete('images/:pageNumber')
  deleteImage(
    @Param('bookId', ParseIntPipe) bookId: number,
    @Param('index', ParseIntPipe) index: number,
    @Param('pageNumber', ParseIntPipe) pageNumber: number,
  ) {
    return this.service.deleteImage(bookId, index, pageNumber);
  }

  @Delete('images')
  deleteImages(
    @Param('bookId', ParseIntPipe) bookId: number,
    @Param('index', ParseIntPipe) index: number,
    @Body() body: { pageNumbers: number[] },
  ) {
    return this.service.deleteImages(bookId, index, body?.pageNumbers ?? []);
  }
}
