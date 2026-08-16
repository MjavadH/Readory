import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminPermissions } from '../auth/permissions.enum';
import { LiveSearchDto } from './dto/live_search_dto';
import { Throttle } from '@nestjs/throttler';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('live')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async liveSearch(@Query() query: LiveSearchDto) {
    return this.searchService.liveSearch(query.q);
  }

  @Get('browse')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async browseSearch(@Query() query: SearchQueryDto) {
    return this.searchService.browseSearch(query);
  }

  @Post('admin/sync-all')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
  @Roles('ADMIN')
  async syncAllBooks() {
    const result = await this.searchService.startFullSync();

    return {
      started: result.started,
      message: result.started
        ? 'Full synchronization started.'
        : 'Full synchronization is already running.',
    };
  }
}
