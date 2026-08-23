import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminPermissions } from '../auth/permissions.enum';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { CreateScheduleDto } from './dto/create-schedule.dto';
import type { UpdateScheduleDto } from './dto/update-schedule.dto';
import type { ScheduledPublishingService } from './scheduled-publishing.service';

@Controller('scheduled-publications')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(RoleName.ADMIN)
@RequirePermissions(AdminPermissions.MANAGE_BOOKS)
export class ScheduledPublishingController {
  constructor(private readonly service: ScheduledPublishingService) {}

  @Get()
  list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
  ) {
    return this.service.list({ page, limit, status });
  }

  @Post()
  create(@Body() dto: CreateScheduleDto, @Request() req: any) {
    return this.service.create(dto, req.user.userId ?? req.user.id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateScheduleDto,
    @Request() req: any,
  ) {
    return this.service.update(id, dto, req.user.userId ?? req.user.id);
  }

  @Post(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.service.cancel(id, req.user.userId ?? req.user.id);
  }

  @Post(':id/publish-now')
  publishNow(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.service.publishNow(id, req.user.userId ?? req.user.id);
  }
}
