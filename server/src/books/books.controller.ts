import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { BooksService } from './books.service';
import { Roles } from '../auth/roles.decorator';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('books')
export class BooksController {
    constructor(private booksService: BooksService) {}

    // Public: list published books
    @Get()
    async list() {
        return this.booksService.findPublished();
    }

    // Public: get book details with chapter list
    @Get(':id')
    async get(@Param('id') id: string) {
        return this.booksService.findById(Number(id));
    }

    // Admin: create a new book
    @UseGuards(JwtAuthGuard)
    @Roles(RoleName.ADMIN)
    @Post()
    async create(@Body() body: {
        title: string;
        author?: string;
        description?: string;
        coverImage?: string;
        isPublished?: boolean;
    }) {
        return this.booksService.create(body);
    }

    // Admin: update an existing book
    @UseGuards(JwtAuthGuard)
    @Roles(RoleName.ADMIN)
    @Patch(':id')
    async update(
        @Param('id') id: string,
        @Body() body: Partial<{
            title: string;
            author?: string;
            description?: string;
            coverImage?: string;
            isPublished?: boolean;
        }>,
    ) {
        return this.booksService.update(Number(id), body);
    }
}
