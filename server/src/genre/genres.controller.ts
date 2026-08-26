import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { AuditAction, AuditCategory } from '@readory/shared';
import { Audit } from '../audit-log/decorators/audit-log.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminPermissions } from '../auth/permissions.enum';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateGenreDto } from './dto/create-genre.dto';
import { UpdateGenreDto } from './dto/update-genre.dto';
import { GenresService } from './genres.service';

@Controller('genres')
export class GenresController {
  constructor(private readonly genresService: GenresService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
  async adminList() {
    return this.genresService.adminListAll();
  }

  @Get('listAll')
  async list() {
    return this.genresService.listAll();
  }

  @Get('featured')
  async featured() {
    return this.genresService.listFeatured();
  }

  @Post()
  @Audit({
    action: AuditAction.GENRE_CREATED,
    category: AuditCategory.CONTENT,
    targetType: 'Genre',
  })
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
  async create(@Body() dto: CreateGenreDto) {
    return this.genresService.create(dto);
  }

  @Patch(':id')
  @Audit({
    action: AuditAction.GENRE_UPDATED,
    category: AuditCategory.CONTENT,
    targetType: 'Genre',
  })
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateGenreDto) {
    return this.genresService.update(id, dto);
  }

  @Delete(':id')
  @Audit({
    action: AuditAction.GENRE_DELETED,
    category: AuditCategory.CONTENT,
    targetType: 'Genre',
  })
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.genresService.delete(id);
  }

  @Get(':slug')
  async getBySlug(@Param('slug') slug: string) {
    return this.genresService.findBySlug(slug);
  }
}
