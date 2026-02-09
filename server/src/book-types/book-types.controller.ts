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
    async create(@Body() dto: CreateBookTypeDto) {
        return this.bookTypesService.create(dto);
    }

    @Patch(':id')
    async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBookTypeDto) {
        return this.bookTypesService.update(id, dto);
    }

    @Delete(':id')
    async remove(@Param('id', ParseIntPipe) id: number) {
        return this.bookTypesService.remove(id);
    }
}
