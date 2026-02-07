import {
    Controller,
    Delete,
    Get,
    Post,
    Patch,
    Param,
    Body,
    UseGuards,
    Request,
    Put,
    ParseIntPipe,
    Query, DefaultValuePipe
} from '@nestjs/common';
import { BooksService } from './books.service';
import { Roles } from '../auth/roles.decorator';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminPermissions } from '../auth/permissions.enum';
import { PermissionsGuard } from '../auth/permissions.guard';
import {RolesGuard} from "../auth/roles.guard";
import { RateBookDto } from './dto/rate-book.dto';

type StatusFilter = 'all' | 'published' | 'draft';

@Controller('books')
export class BooksController {
    constructor(private booksService: BooksService) {}

    // Public: list published books
    @Get()
    async listPublished(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
        @Query('q') q?: string,
    ) {
        return this.booksService.listPublished({ page, limit, q });
    }

    // List all books
    @Get('allBooks')
    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
    @Roles(RoleName.ADMIN)
    @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
    async listBooks(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
        @Query('q') q?: string,
        @Query('status') status: StatusFilter = 'all',
    ) {
        return this.booksService.listAll({ page, limit, q, status });
    }

    @Get('type/:type')
    async getBooksByType(@Param('type') type: string) {
        return this.booksService.findByType(type);
    }

    // Public: get book details with chapter list
    @Get(':id')
    async get(@Param('id', ParseIntPipe) id: number) {
        return this.booksService.findById(id);
    }

    // Admin: create a new book
    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
    @Roles(RoleName.ADMIN)
    @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
    @Post()
    async create(@Body() dto: CreateBookDto) {
        return this.booksService.create(dto);
    }

    // Admin: update an existing book
    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
    @Roles(RoleName.ADMIN)
    @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
    @Patch(':id')
    async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBookDto) {
        return this.booksService.update(id, dto);
    }

    @Put(':id/rating')
    @UseGuards(JwtAuthGuard)
    async rateBook(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: RateBookDto,
        @Request() req: any,
    ) {
        const userId = req.user.userId ?? req.user.id;
        return this.booksService.rateBook(Number(userId), id, dto.rating);
    }

    // delete book
    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
    @Roles(RoleName.ADMIN)
    @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
    async delete(@Param('id', ParseIntPipe) id: number) {
        return this.booksService.deleteById(id);
    }
}
