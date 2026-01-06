import { Controller, Delete, Get, ParseIntPipe, Patch, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ChaptersService } from './chapters.service';
import { Roles } from '../auth/roles.decorator';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminPermissions } from '../auth/permissions.enum';
import { PermissionsGuard } from '../auth/permissions.guard';
import {RolesGuard} from "../auth/roles.guard";

@Controller('books/:bookId/chapters')
export class ChaptersController {
    constructor(private chaptersService: ChaptersService) {}

    // Public: list chapters of a book
    @Get()
    async list(@Param('bookId', ParseIntPipe) bookId: number) {
        return this.chaptersService.listChapters(bookId);
    }

    // Admin: add a new chapter to a book
    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
    @Roles(RoleName.ADMIN)
    @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
    @Post()
    async create(@Param('bookId', ParseIntPipe) bookId: number, @Body() dto: CreateChapterDto) {
        return this.chaptersService.createChapter(bookId, dto);
    }

    // Admin: edit chapter
    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
    @Roles(RoleName.ADMIN)
    @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
    @Patch(':chapterId')
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
    async remove(
        @Param('bookId', ParseIntPipe) bookId: number,
        @Param('chapterId', ParseIntPipe) chapterId: number,
    ) {
        return this.chaptersService.deleteChapter(bookId, chapterId);
    }

    // User: purchase a chapter
    @UseGuards(JwtAuthGuard)
    @Post(':chapterId/purchase')
    async purchase(
        @Param('chapterId', ParseIntPipe) chapterId: number,
        @Request() req: any,
    ) {
        return this.chaptersService.purchaseChapter(req.user.userId, chapterId);
    }
}
