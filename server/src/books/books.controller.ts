import { Controller, Delete, Get, Post, Patch, Request, Param, Body, UseGuards, ParseIntPipe } from '@nestjs/common';
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

@Controller('books')
export class BooksController {
    constructor(private booksService: BooksService) {}

    @Get('count')
    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
    @Roles(RoleName.ADMIN)
    @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
    async countBooks() {
        const count = await this.booksService.countAll();
        return { count };
    }

    // Public: list published books
    @Get()
    async listPublished() {
        return this.booksService.findPublished();
    }

    // List all books
    @Get('allBooks')
    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
    @Roles(RoleName.ADMIN)
    @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
    async listBooks() {
        return this.booksService.listAll();
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

    @UseGuards(JwtAuthGuard)
    @Post(':id/purchase')
    async purchase(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
        return this.booksService.purchaseBook(req.user.userId, id);
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

    // delete book
    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
    @Roles(RoleName.ADMIN)
    @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
    async delete(@Param('id', ParseIntPipe) id: number) {
        return this.booksService.deleteById(id);
    }
}
