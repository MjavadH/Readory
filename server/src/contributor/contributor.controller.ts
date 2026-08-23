import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
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
import type { ContributorService } from './contributor.service';
import type { CreateContributorDto } from './dto/create-contributor.dto';
import type { UpdateContributorDto } from './dto/update-contributor.dto';

@Controller('contributor')
export class ContributorController {
  constructor(private readonly contributorService: ContributorService) {}

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
  @Post()
  @Audit({
    action: AuditAction.CONTRIBUTOR_CREATED,
    category: AuditCategory.CONTENT,
    targetType: 'Contributor',
  })
  create(@Body() createContributorDto: CreateContributorDto) {
    return this.contributorService.create(createContributorDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
    @Query('q') q?: string,
  ) {
    return this.contributorService.findAll({ page, limit, q });
  }

  @Get('public/:slug')
  async getPublicProfile(
    @Param('slug') slug: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '18',
  ) {
    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const limitNumber = Math.min(50, Math.max(1, parseInt(limit, 10) || 18));

    return this.contributorService.getPublicProfile(slug, pageNumber, limitNumber);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.contributorService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
  @Patch(':id')
  @Audit({
    action: AuditAction.CONTRIBUTOR_UPDATED,
    category: AuditCategory.CONTENT,
    targetType: 'Contributor',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateContributorDto: UpdateContributorDto,
  ) {
    return this.contributorService.update(id, updateContributorDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
  @Delete(':id')
  @Audit({
    action: AuditAction.CONTRIBUTOR_DELETED,
    category: AuditCategory.CONTENT,
    targetType: 'Contributor',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.contributorService.remove(id);
  }
}
