import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RoleName } from '@prisma/client';
import { AuditAction, AuditCategory } from '@readory/shared';
import { Audit } from '../audit-log/decorators/audit-log.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminPermissions } from '../auth/permissions.enum';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CollectionsService } from './collections.service';
import {
  AddCollectionItemDto,
  ReorderCollectionItemsDto,
  UpdateCollectionItemDto,
} from './dto/collection-items.dto';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  async listSystem(@Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    return this.collectionsService.listSystem({ cursor, limit: limit ? Number(limit) : undefined });
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  async listMine(
    @Query('cursor') cursor: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('bookId') bookId: string | undefined,
    @Request() req: any,
  ) {
    const userId = req.user.userId ?? req.user.id;
    return this.collectionsService.listMine(Number(userId), {
      cursor,
      limit: limit ? Number(limit) : undefined,
      bookId: bookId ? Number(bookId) : undefined,
    });
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
  async getAdminById(
    @Param('id', ParseIntPipe) id: number,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.collectionsService.getAdminById(id, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  async getBySlug(
    @Param('slug') slug: string,
    @Query('cursor') cursor: string | undefined,
    @Query('limit') limit: string | undefined,
    @Request() req: any,
  ) {
    const userId = req.user?.userId ?? req.user?.id;
    return this.collectionsService.getBySlug(
      slug,
      userId ? Number(userId) : undefined,
      req.user?.roleName === RoleName.ADMIN,
      { cursor, limit: limit ? Number(limit) : undefined },
    );
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
  @Audit({
    action: AuditAction.COLLECTION_CREATED,
    category: AuditCategory.CONTENT,
    targetType: 'Collection',
    adminOnly: true,
  })
  async createSystem(@Body() dto: CreateCollectionDto) {
    return this.collectionsService.createSystemCollection(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @Audit({
    action: AuditAction.COLLECTION_UPDATED,
    category: AuditCategory.CONTENT,
    targetType: 'Collection',
    adminOnly: true,
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCollectionDto,
    @Request() req: any,
  ) {
    const userId = req.user.userId ?? req.user.id;
    return this.collectionsService.update(
      id,
      Number(userId),
      req.user.roleName === RoleName.ADMIN,
      dto,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @Audit({
    action: AuditAction.COLLECTION_DELETED,
    category: AuditCategory.CONTENT,
    targetType: 'Collection',
    adminOnly: true,
  })
  async delete(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    const userId = req.user.userId ?? req.user.id;
    return this.collectionsService.delete(id, Number(userId), req.user.roleName === RoleName.ADMIN);
  }

  @Post(':id/items')
  @UseGuards(JwtAuthGuard)
  @Audit({
    action: AuditAction.COLLECTION_UPDATED,
    category: AuditCategory.CONTENT,
    targetType: 'Collection',
    targetIdParam: 'id',
    adminOnly: true,
  })
  async addBook(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddCollectionItemDto,
    @Request() req: any,
  ) {
    const userId = req.user.userId ?? req.user.id;
    return this.collectionsService.addBook(
      id,
      Number(userId),
      req.user.roleName === RoleName.ADMIN,
      dto.bookId,
      dto.note,
    );
  }

  @Patch(':id/items/:itemId')
  @UseGuards(JwtAuthGuard)
  @Audit({
    action: AuditAction.COLLECTION_UPDATED,
    category: AuditCategory.CONTENT,
    targetType: 'Collection',
    targetIdParam: 'id',
    adminOnly: true,
  })
  async updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateCollectionItemDto,
    @Request() req: any,
  ) {
    const userId = req.user.userId ?? req.user.id;
    return this.collectionsService.updateItem(
      id,
      itemId,
      Number(userId),
      req.user.roleName === RoleName.ADMIN,
      dto.note,
    );
  }

  @Delete(':id/items/:itemId')
  @UseGuards(JwtAuthGuard)
  @Audit({
    action: AuditAction.COLLECTION_UPDATED,
    category: AuditCategory.CONTENT,
    targetType: 'Collection',
    targetIdParam: 'id',
    adminOnly: true,
  })
  async removeBook(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Request() req: any,
  ) {
    const userId = req.user.userId ?? req.user.id;
    return this.collectionsService.removeBook(
      id,
      itemId,
      Number(userId),
      req.user.roleName === RoleName.ADMIN,
    );
  }

  @Put(':id/items/reorder')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  @Audit({
    action: AuditAction.COLLECTION_UPDATED,
    category: AuditCategory.CONTENT,
    targetType: 'Collection',
    targetIdParam: 'id',
    adminOnly: true,
  })
  async reorder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReorderCollectionItemsDto,
    @Request() req: any,
  ) {
    const userId = req.user.userId ?? req.user.id;
    return this.collectionsService.reorder(
      id,
      Number(userId),
      req.user.roleName === RoleName.ADMIN,
      dto.itemIds,
    );
  }
}

@Controller('u/:username/collections')
export class UserCollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
  async getAdminById(
    @Param('id', ParseIntPipe) id: number,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.collectionsService.getAdminById(id, {
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  async getUserCollection(
    @Param('username') username: string,
    @Param('slug') slug: string,
    @Query('cursor') cursor: string | undefined,
    @Query('limit') limit: string | undefined,
    @Request() req: any,
  ) {
    const userId = req.user?.userId ?? req.user?.id;
    return this.collectionsService.getUserCollection(
      username,
      slug,
      userId ? Number(userId) : undefined,
      { cursor, limit: limit ? Number(limit) : undefined },
    );
  }
}
