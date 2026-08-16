import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminPermissions } from '../auth/permissions.enum';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('live')
  async liveSearch(@Query('q') q: string) {
    return this.searchService.liveSearch(q || '');
  }

  @Get('browse')
  async browseSearch(@Query() query: SearchQueryDto) {
    return this.searchService.browseSearch(query);
  }

  @Post('admin/sync-all')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(AdminPermissions.MANAGE_BOOKS)
  @Roles('ADMIN')
  async syncAllBooks() {
    await this.searchService.syncAllDatabaseBooks();
    return { message: 'Full synchronization started successfully.' };
  }
}
