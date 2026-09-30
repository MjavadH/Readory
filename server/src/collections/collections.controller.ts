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
import type {
  AuthenticatedRequest,
  OptionalAuthRequest,
} from '../common/interfaces/request.interface';
import { CollectionsService } from './collections.service';
import type { Actor } from './collections.types';
import {
  AddCollectionItemDto,
  ReorderCollectionItemsDto,
  UpdateCollectionItemDto,
} from './dto/collection-items.dto';
import { CursorPageQueryDto, MyCollectionsQueryDto } from './dto/collection-query.dto';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { CreateSystemCollectionDto } from './dto/create-system-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

const toActor = (req: AuthenticatedRequest): Actor => ({
  id: Number(req.user.userId ?? req.user.id),
  isAdmin: req.user.roleName === RoleName.ADMIN,
});

const toViewerId = (req: OptionalAuthRequest): number | undefined => {
  const id = req.user?.userId ?? req.user?.id;
  return id ? Number(id) : undefined;
};

@Controller('collections')
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get()
  listSystem(@Query() query: CursorPageQueryDto) {
    return this.collections.listSystem(query);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  listMine(@Query() query: MyCollectionsQueryDto, @Request() req: AuthenticatedRequest) {
    return this.collections.listMine(toActor(req).id, query.bookId);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
  listAdmin(@Query() query: CursorPageQueryDto) {
    return this.collections.listAdmin(query);
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
  getAdminById(@Param('id', ParseIntPipe) id: number, @Query() query: CursorPageQueryDto) {
    return this.collections.getAdminById(id, query);
  }

  /** Public and viewer-independent (no auth): PRIVATE system collections are 404 here. */
  @Get(':slug')
  getBySlug(@Param('slug') slug: string, @Query() query: CursorPageQueryDto) {
    return this.collections.getSystemBySlug(slug, query);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  createUser(@Body() dto: CreateCollectionDto, @Request() req: AuthenticatedRequest) {
    return this.collections.createUserCollection(toActor(req).id, dto);
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
  createSystem(@Body() dto: CreateSystemCollectionDto) {
    return this.collections.createSystemCollection(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @Audit({
    action: AuditAction.COLLECTION_UPDATED,
    category: AuditCategory.CONTENT,
    targetType: 'Collection',
    adminOnly: true,
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCollectionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.collections.update(id, toActor(req), dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @Audit({
    action: AuditAction.COLLECTION_DELETED,
    category: AuditCategory.CONTENT,
    targetType: 'Collection',
    adminOnly: true,
  })
  delete(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest) {
    return this.collections.delete(id, toActor(req));
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
  addBook(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddCollectionItemDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.collections.addBook(id, toActor(req), dto);
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
  reorder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReorderCollectionItemsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.collections.reorder(id, toActor(req), dto.itemIds);
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
  updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateCollectionItemDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.collections.updateItem(id, itemId, toActor(req), dto);
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
  removeBook(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.collections.removeBook(id, itemId, toActor(req));
  }
}

@Controller('u/:username/collections')
export class UserCollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  getUserCollection(
    @Param('username') username: string,
    @Param('slug') slug: string,
    @Query() query: CursorPageQueryDto,
    @Request() req: OptionalAuthRequest,
  ) {
    return this.collections.getUserCollection(username, slug, toViewerId(req), query);
  }
}
