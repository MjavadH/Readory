import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminPermissions } from '../auth/permissions.enum';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { LiveSearchDto } from './dto/live_search_dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchService } from './search.service';

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
