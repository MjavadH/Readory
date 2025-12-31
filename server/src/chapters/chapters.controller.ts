import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ChaptersService } from './chapters.service';
import { Roles } from '../auth/roles.decorator';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('books/:bookId/chapters')
export class ChaptersController {
    constructor(private chaptersService: ChaptersService) {}

    // Public: list chapters of a book
    @Get()
    async list(@Param('bookId') bookId: string) {
        return this.chaptersService.listChapters(Number(bookId));
    }

    // Admin: add a new chapter to a book
    @UseGuards(JwtAuthGuard)
    @Roles(RoleName.ADMIN)
    @Post()
    async create(
        @Param('bookId') bookId: string,
        @Body() body: {
            title: string;
            index: number;
            price?: number;
            isFree?: boolean;
            contentPath?: string;
        },
    ) {
        return this.chaptersService.createChapter(Number(bookId), body);
    }

    // User: purchase a chapter
    @UseGuards(JwtAuthGuard)
    @Post(':chapterId/purchase')
    async purchase(
        @Param('bookId') bookId: string,
        @Param('chapterId') chapterId: string,
        @Request() req: any,
    ) {
        // bookId is unused here but could be validated
        return this.chaptersService.purchaseChapter(req.user.userId, Number(chapterId));
    }
}
