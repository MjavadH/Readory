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
  Request,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminPermissions } from '../auth/permissions.enum';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { CreateBroadcastDto } from './dto/create-broadcast.dto';
import type { NotificationsService } from './notifications.service';

type AuthenticatedRequest = { user: { userId?: number | string; id?: number | string } };

@Controller('notifications')
export class NotificationsController {
  constructor(private service: NotificationsService) {}
  private uid(req: AuthenticatedRequest) {
    return Number(req.user.userId ?? req.user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(
    @Request() req: AuthenticatedRequest,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string,
  ) {
    return this.service.list(this.uid(req), limit, cursor);
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  unread(@Request() req: AuthenticatedRequest) {
    return this.service.unreadCount(this.uid(req));
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  read(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.markRead(this.uid(req), id);
  }

  @Patch('read')
  @UseGuards(JwtAuthGuard)
  readMany(@Request() req: AuthenticatedRequest, @Body('ids') ids?: string[]) {
    return this.service.markAllRead(this.uid(req), ids);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  dismiss(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.dismiss(this.uid(req), id);
  }

  @Get('books/:bookId/subscription')
  @UseGuards(JwtAuthGuard)
  subscription(
    @Request() req: AuthenticatedRequest,
    @Param('bookId', ParseIntPipe) bookId: number,
  ) {
    return this.service.getSubscription(this.uid(req), bookId);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('books/:bookId/subscription')
  @UseGuards(JwtAuthGuard)
  subscribe(@Request() req: AuthenticatedRequest, @Param('bookId', ParseIntPipe) bookId: number) {
    return this.service.subscribe(this.uid(req), bookId);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Delete('books/:bookId/subscription')
  @UseGuards(JwtAuthGuard)
  unsubscribe(@Request() req: AuthenticatedRequest, @Param('bookId', ParseIntPipe) bookId: number) {
    return this.service.unsubscribe(this.uid(req), bookId);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('admin/broadcasts')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_NOTIFICATIONS)
  createBroadcast(@Request() req: AuthenticatedRequest, @Body() dto: CreateBroadcastDto) {
    return this.service.createBroadcast(dto, this.uid(req));
  }

  @Get('admin/broadcasts')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_NOTIFICATIONS)
  broadcasts(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.service.listBroadcasts(page, limit);
  }
}
