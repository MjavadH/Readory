import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { RoleName } from '@prisma/client';
import { AuditAction, AuditCategory } from '@readory/shared';
import { Audit } from '../audit-log/decorators/audit-log.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminPermissions } from '../auth/permissions.enum';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { WalletsService } from '../wallets/wallets.service';
import { AvatarService } from './avatar.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly walletsService: WalletsService,
    private readonly configService: ConfigService,
    private readonly avatarService: AvatarService,
    private readonly rateLimitService: RateLimitService,
    private readonly prisma: PrismaService,
  ) {}

  private getSuperAdminId(): number {
    return Number(this.configService.get<number>('SUPER_ADMIN_ID')) || 1;
  }

  private async assertTrustedSession(sessionId?: string) {
    if (!sessionId) throw new ForbiddenException('Trusted device required.');
    const session = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
      select: { createdAt: true },
    });
    if (!session || Date.now() - session.createdAt.getTime() < 48 * 60 * 60 * 1000) {
      throw new ForbiddenException(
        'This security action is unavailable on new devices for 48 hours.',
      );
    }
  }

  private checkHierarchy(targetUserId: number, requesterId: number) {
    const superAdminId = this.getSuperAdminId();

    if (targetUserId === superAdminId) {
      throw new BadRequestException('Action not allowed on Super Admin.');
    }

    if (targetUserId === requesterId) {
      throw new BadRequestException('You cannot change your own stats');
    }
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(
    AdminPermissions.MANAGE_USERS,
    AdminPermissions.MANAGE_FINANCE,
    AdminPermissions.MANAGE_STAFF,
  )
  async getUserStats() {
    return this.usersService.getUsersStats();
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(
    AdminPermissions.MANAGE_USERS,
    AdminPermissions.MANAGE_FINANCE,
    AdminPermissions.MANAGE_STAFF,
  )
  async listUsers(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('search') search: string = '',
    @Query('role') role?: string,
  ) {
    const { users, total } = await this.usersService.findAll(
      Number(page),
      Number(limit),
      search,
      role,
    );
    const formattedUsers = users.map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      role: u.role?.name || 'USER',
      permissions: u.permissions || [],
      lastLogin: u.lastLoginAt,
      joinedAt: u.createdAt,
      balance: u.wallet?.balance ? u.wallet.balance.toNumber() : 0,
      status: u.isBanned ? 'BANNED' : 'ACTIVE',
      avatarKey: u.avatarKey,
    }));
    return {
      data: formattedUsers,
      total,
      page: Number(page),
      lastPage: Math.ceil(total / Number(limit)),
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(
    AdminPermissions.MANAGE_USERS,
    AdminPermissions.MANAGE_FINANCE,
    AdminPermissions.MANAGE_STAFF,
  )
  async getUserDetails(@Param('id', ParseIntPipe) id: number) {
    const user = await this.usersService.findOneWithDetails(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      status: user.isBanned ? 'BANNED' : 'ACTIVE',
      avatarKey: user.avatarKey,

      wallet: {
        balance: user.wallet?.balance ? Number(user.wallet.balance) : 0,
        transactions:
          user.wallet?.transactions.map((t) => ({
            id: t.id,
            amount: Number(t.amount),
            type: t.type,
            reference: t.reference,
            createdAt: t.createdAt,
          })) || [],
      },

      accessRecords: user.accessRecords.map((r) => ({
        id: r.id,
        chapterId: r.chapterId,
        purchasedAt: r.purchasedAt,
        chapterTitle: r.chapter?.title || 'Deleted Chapter',
        bookTitle: r.chapter?.book?.title || 'Unknown Book',
        price: r.chapter?.price ? Number(r.chapter.price) : 0,
      })),
    };
  }

  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: 5 * 1024 * 1024 - 1, files: 1 },
    }),
  )
  async updateMyAvatar(@Request() req: any, @UploadedFile() file?: Express.Multer.File) {
    await this.rateLimitService.consume({
      key: this.rateLimitService.key('avatar', req.user.userId),
      limit: 5,
      ttlSeconds: 3600,
      message: 'Too many avatar changes. Please try again later.',
    });
    return this.avatarService.replaceAvatar(req.user.userId, file as Express.Multer.File);
  }

  @Throttle({ default: { limit: 6, ttl: 3600000 } })
  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(@Request() req: any, @Body() dto: UpdateUserDto) {
    if (dto.username !== undefined || dto.newPassword !== undefined) {
      await this.assertTrustedSession(req.user.sessionId);
    }
    const result = await this.usersService.updateUser(req.user.userId, dto);

    return result;
  }

  @Patch(':id/role')
  @Audit({
    action: AuditAction.STAFF_UPDATED,
    category: AuditCategory.STAFF,
    targetType: 'User',
  })
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_STAFF)
  async changeRole(
    @Param('id', ParseIntPipe) id: number,
    @Body('role') role: 'ADMIN' | 'USER',
    @Request() req: any,
  ) {
    this.checkHierarchy(id, req.user.userId);
    const superAdminId = this.getSuperAdminId();
    const targetUser = await this.usersService.findById(id);
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const targetHasStaffPerm = targetUser.permissions.includes(AdminPermissions.MANAGE_STAFF);
    const isRequesterSuperAdmin = req.user.userId === superAdminId;
    if (targetHasStaffPerm && !isRequesterSuperAdmin) {
      throw new ForbiddenException('Only Super Admin can remove a Staff Manager.');
    }

    await this.usersService.updateRole(id, role);

    return { success: true };
  }

  @Patch(':id/ban')
  @Audit({
    action: AuditAction.USER_BANNED,
    category: AuditCategory.SECURITY,
    targetType: 'User',
  })
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_USERS)
  async changeBanStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('isBanned') isBanned: boolean,
    @Request() req: any,
  ) {
    this.checkHierarchy(id, req.user.userId);

    await this.usersService.setBanStatus(id, isBanned);
    return { success: true };
  }

  @Post(':id/balance/credit')
  @Audit({
    action: AuditAction.BALANCE_CREDIT,
    category: AuditCategory.FINANCE,
    targetType: 'User',
  })
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_FINANCE)
  async creditBalance(@Param('id', ParseIntPipe) userId: number, @Body() body: { amount: number }) {
    const amount = Number(body.amount);
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    return this.walletsService.credit(userId, amount, 'Admin Manual Deposit');
  }

  @Post(':id/balance/debit')
  @Audit({
    action: AuditAction.BALANCE_DEBIT,
    category: AuditCategory.FINANCE,
    targetType: 'User',
  })
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_FINANCE)
  async debitBalance(@Param('id', ParseIntPipe) userId: number, @Body() body: { amount: number }) {
    const amount = Number(body.amount);
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    return this.walletsService.debit(userId, amount, 'Admin Manual Deduction');
  }

  @Patch(':id/permissions')
  @Audit({
    action: AuditAction.USER_PERMISSIONS_UPDATED,
    category: AuditCategory.SECURITY,
    targetType: 'User',
  })
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles(RoleName.ADMIN)
  @RequirePermissions(AdminPermissions.MANAGE_STAFF)
  async updatePermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body('permissions') permissions: string[],
    @Request() req: any,
  ) {
    this.checkHierarchy(id, req.user.userId);

    const superAdminId = this.getSuperAdminId();
    const isRequesterSuperAdmin = req.user.userId === superAdminId;
    if (permissions.includes(AdminPermissions.MANAGE_STAFF) && !isRequesterSuperAdmin) {
      throw new ForbiddenException('Only Super Admin can grant MANAGE_STAFF permission.');
    }
    await this.usersService.updatePermissions(id, permissions);
    return { success: true };
  }
}
