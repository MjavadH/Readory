import { Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminPermissions } from '../auth/permissions.enum';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { BookChapterCountSyncService } from './book-chapter-count-sync.service';

@Controller('admin/maintenance')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(RoleName.ADMIN)
@RequirePermissions(AdminPermissions.MANAGE_BOOKS)
export class BookMaintenanceController {
  constructor(private readonly bookChapterCountSyncService: BookChapterCountSyncService) {}

  @Post('sync-book-chapter-counts')
  @Throttle({
    default: {
      limit: 3,
      ttl: 60_000,
    },
  })
  async syncBookChapterCounts() {
    const result = await this.bookChapterCountSyncService.enqueueDailySync();

    return {
      started: result.started,
      jobId: result.jobId,
      businessDay: result.businessDay,
      message: 'Book chapter count synchronization queued successfully.',
    };
  }
}
