import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { BookTypesService } from './book-types.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminPermissions } from '../auth/permissions.enum';
import { RoleName } from '@prisma/client';
import { CreateBookTypeDto } from './dto/create-book-type.dto';
import { UpdateBookTypeDto } from './dto/update-book-type.dto';
import { Audit } from '../audit-log/decorators/audit-log.decorator';
import {
  AuditAction,
  AuditCategory,
} from '@readory/shared';

@Controller('book-types')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(RoleName.ADMIN)
@RequirePermissions(AdminPermissions.MANAGE_BOOKS)
export class BookTypesController {
    constructor(private readonly bookTypesService: BookTypesService) {}

    @Get()
    async list() {
        return this.bookTypesService.listAdmin();
    }

    @Post()
    @Audit({
        action: AuditAction.BOOK_TYPE_CREATED,
        category: AuditCategory.CONTENT,
        targetType: 'BookType',
    })
    async create(@Body() dto: CreateBookTypeDto) {
        return this.bookTypesService.create(dto);
    }

    @Patch(':id')
    @Audit({
        action: AuditAction.BOOK_TYPE_UPDATED,
        category: AuditCategory.CONTENT,
        targetType: 'BookType',
    })
    async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBookTypeDto) {
        return this.bookTypesService.update(id, dto);
    }

    @Delete(':id')
    @Audit({
        action: AuditAction.BOOK_TYPE_DELETED,
        category: AuditCategory.CONTENT,
        targetType: 'BookType',
    })
    async remove(@Param('id', ParseIntPipe) id: number) {
        return this.bookTypesService.remove(id);
    }
}
