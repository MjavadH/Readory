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
  Query,
  DefaultValuePipe,
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
import { RolesGuard } from '../auth/roles.guard';
import { RateBookDto } from './dto/rate-book.dto';
import { BrowseBooksDto } from './dto/browse-books.dto';
import { BrowseTypeBooksDto } from './dto/browse-type-books.dto';
import { Audit } from '../audit-log/decorators/audit-log.decorator';
import {
  AuditAction,
  AuditCategory,
} from '../audit-log/constants/audit-log.constants';

type StatusFilter = 'all' | 'published' | 'draft' | 'featured';

@Controller('books')
export class BooksController {
  constructor(private booksService: BooksService) {}

  @Get('browse')
  async browse(@Query() query: BrowseBooksDto) {
    return this.booksService.browse(query);
  }

  @Get('favorites')
  @UseGuards(JwtAuthGuard)
  async getFavorites(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
    @Request() req: any,
  ) {
    const userId = req.user.userId ?? req.user.id;
    return this.booksService.getFavorites(Number(userId), { page, limit });
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

  // Admin: get full book details
  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
  async getFullBookDetails(@Param('id', ParseIntPipe) id: number) {
    return this.booksService.fullBookDetails(id);
  }

  @Get(':id/viewer-state')
  @UseGuards(JwtAuthGuard)
  async getViewerState(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    const userId = req.user.userId ?? req.user.id;
    return this.booksService.getViewerState(id, Number(userId));
  }

  // Public: get book details
  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number) {
    return this.booksService.findById(id);
  }

  @Get(':id/related')
  async related(
    @Param('id', ParseIntPipe) id: number,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
  ) {
    return this.booksService.getRelatedBooks(id, limit);
  }

  @Get('type/:type/browse')
  async browseByType(
    @Param('type') type: string,
    @Query() query: BrowseTypeBooksDto,
  ) {
    return this.booksService.browseByType(type, query);
  }

  // Admin: create a new book
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
  @Post()
  @Audit({
    action: AuditAction.BOOK_CREATED,
    category: AuditCategory.CONTENT,
    targetType: 'Book',
  })
  async create(@Body() dto: CreateBookDto) {
    return this.booksService.create(dto);
  }

  // Admin: update an existing book
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
  @Patch(':id')
  @Audit({
    action: AuditAction.BOOK_UPDATED,
    category: AuditCategory.CONTENT,
    targetType: 'Book',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBookDto,
  ) {
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

  @Post(':id/favorite')
  @UseGuards(JwtAuthGuard)
  async toggleFavorite(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    const userId = req.user.userId ?? req.user.id;
    return this.booksService.toggleFavorite(Number(userId), id);
  }

  // delete book
  @Delete(':id')
  @Audit({
    action: AuditAction.BOOK_DELETED,
    category: AuditCategory.CONTENT,
    targetType: 'Book',
  })
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.booksService.deleteById(id);
  }
}
