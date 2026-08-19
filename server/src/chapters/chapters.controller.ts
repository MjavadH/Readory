import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ChaptersService } from './chapters.service';
import { Roles } from '../auth/roles.decorator';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminPermissions } from '../auth/permissions.enum';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ListChaptersDto } from './dto/list-chapters.dto';
import { Audit } from '../audit-log/decorators/audit-log.decorator';
import { AuditAction, AuditCategory, PublicationStatus } from '@readory/shared';

@Controller('books/:bookId/chapters')
export class ChaptersController {
  constructor(private chaptersService: ChaptersService) {}

  // Public: list chapters of a book
  @Get()
  async list(@Param('bookId', ParseIntPipe) bookId: number, @Query() query: ListChaptersDto) {
    return this.chaptersService.listChapters(bookId, {
      ...query,
      publishStatus: PublicationStatus.PUBLISHED,
    });
  }

  // Admin: full list chapters of a book
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
  @Get('admin')
  async fullList(@Param('bookId', ParseIntPipe) bookId: number, @Query() query: ListChaptersDto) {
    return this.chaptersService.listChapters(bookId, query, true, true);
  }

  // Admin: add a new chapter to a book
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
  @Post()
  @Audit({
    action: AuditAction.CHAPTER_CREATED,
    category: AuditCategory.CONTENT,
    targetType: 'Chapter',
  })
  async create(@Param('bookId', ParseIntPipe) bookId: number, @Body() dto: CreateChapterDto) {
    return this.chaptersService.createChapter(bookId, dto);
  }

  // Admin: edit chapter
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
  @Patch(':chapterId')
  @Audit({
    action: AuditAction.CHAPTER_UPDATED,
    category: AuditCategory.CONTENT,
    targetType: 'Chapter',
    targetIdParam: 'chapterId',
  })
  async update(
    @Param('bookId', ParseIntPipe) bookId: number,
    @Param('chapterId', ParseIntPipe) chapterId: number,
    @Body() dto: UpdateChapterDto,
  ) {
    return this.chaptersService.updateChapter(bookId, chapterId, dto);
  }

  // Admin: delete chapter
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
  @Delete(':chapterId')
  @Audit({
    action: AuditAction.CHAPTER_DELETED,
    category: AuditCategory.CONTENT,
    targetType: 'Chapter',
    targetIdParam: 'chapterId',
  })
  async remove(
    @Param('bookId', ParseIntPipe) bookId: number,
    @Param('chapterId', ParseIntPipe) chapterId: number,
  ) {
    return this.chaptersService.deleteChapter(bookId, chapterId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('index/:index/access')
  async getAccessibleChapterByIndex(
    @Param('bookId', ParseIntPipe) bookId: number,
    @Param('index', ParseIntPipe) index: number,
    @Request() req: any,
  ) {
    return this.chaptersService.getAccessibleChapterByIndex(bookId, index, req.user.userId);
  }

  // User: purchase a chapter
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post(':chapterId/purchase')
  async purchase(@Param('chapterId', ParseIntPipe) chapterId: number, @Request() req: any) {
    return this.chaptersService.purchaseChapter(req.user.userId, chapterId);
  }
}
