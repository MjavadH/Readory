import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminPermissions } from '../auth/permissions.enum';
import { CollectionsService } from './collections.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { AddCollectionItemDto, ReorderCollectionItemsDto, UpdateCollectionItemDto } from './dto/collection-items.dto';

@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  async listSystem(@Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    return this.collectionsService.listSystem({ cursor, limit: limit ? Number(limit) : undefined });
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
  async listAdmin(@Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    return this.collectionsService.listAdmin({ cursor, limit: limit ? Number(limit) : undefined });
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
  async getAdminById(@Param('id', ParseIntPipe) id: number) {
    return this.collectionsService.getAdminById(id);
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  async getBySlug(@Param('slug') slug: string, @Request() req: any) {
    const userId = req.user?.userId ?? req.user?.id;
    return this.collectionsService.getBySlug(slug, userId ? Number(userId) : undefined, req.user?.roleName === RoleName.ADMIN);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async createUser(@Body() dto: CreateCollectionDto, @Request() req: any) {
    const userId = req.user.userId ?? req.user.id;
    return this.collectionsService.createUserCollection(Number(userId), dto);
  }

  @Post('system')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
  async createSystem(@Body() dto: CreateCollectionDto) {
    return this.collectionsService.createSystemCollection(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCollectionDto, @Request() req: any) {
    const userId = req.user.userId ?? req.user.id;
    return this.collectionsService.update(id, Number(userId), req.user.roleName === RoleName.ADMIN, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    const userId = req.user.userId ?? req.user.id;
    return this.collectionsService.delete(id, Number(userId), req.user.roleName === RoleName.ADMIN);
  }

  @Post(':id/items')
  @UseGuards(JwtAuthGuard)
  async addBook(@Param('id', ParseIntPipe) id: number, @Body() dto: AddCollectionItemDto, @Request() req: any) {
    const userId = req.user.userId ?? req.user.id;
    return this.collectionsService.addBook(id, Number(userId), req.user.roleName === RoleName.ADMIN, dto.bookId, dto.note);
  }


  @Patch(':id/items/:itemId')
  @UseGuards(JwtAuthGuard)
  async updateItem(@Param('id', ParseIntPipe) id: number, @Param('itemId', ParseIntPipe) itemId: number, @Body() dto: UpdateCollectionItemDto, @Request() req: any) {
    const userId = req.user.userId ?? req.user.id;
    return this.collectionsService.updateItem(id, itemId, Number(userId), req.user.roleName === RoleName.ADMIN, dto.note);
  }

  @Delete(':id/items/:itemId')
  @UseGuards(JwtAuthGuard)
  async removeBook(@Param('id', ParseIntPipe) id: number, @Param('itemId', ParseIntPipe) itemId: number, @Request() req: any) {
    const userId = req.user.userId ?? req.user.id;
    return this.collectionsService.removeBook(id, itemId, Number(userId), req.user.roleName === RoleName.ADMIN);
  }

  @Put(':id/items/reorder')
  @UseGuards(JwtAuthGuard)
  async reorder(@Param('id', ParseIntPipe) id: number, @Body() dto: ReorderCollectionItemsDto, @Request() req: any) {
    const userId = req.user.userId ?? req.user.id;
    return this.collectionsService.reorder(id, Number(userId), req.user.roleName === RoleName.ADMIN, dto.itemIds);
  }
}

@Controller('u/:username/collections')
export class UserCollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
  async getAdminById(@Param('id', ParseIntPipe) id: number) {
    return this.collectionsService.getAdminById(id);
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  async getUserCollection(@Param('username') username: string, @Param('slug') slug: string, @Request() req: any) {
    const userId = req.user?.userId ?? req.user?.id;
    return this.collectionsService.getUserCollection(username, slug, userId ? Number(userId) : undefined);
  }
}
