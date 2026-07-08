import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Roles } from '../auth/roles.decorator';
import { RequirePermissions } from '../auth/permissions.decorator';
import { AdminPermissions } from '../auth/permissions.enum';
import { AuditLogService } from './audit-log.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(RoleName.ADMIN)
@RequirePermissions(AdminPermissions.MANAGE_STAFF)
export class AuditLogController {
  constructor(private readonly auditLog: AuditLogService) {}

  @Get() findMany(@Query() query: AuditLogQueryDto) {
    return this.auditLog.findMany(query);
  }

  @Get('entity/:targetType/:targetId') history(
    @Param('targetType') targetType: string,
    @Param('targetId') targetId: string,
    @Query() query: AuditLogQueryDto,
  ) {
    return this.auditLog.findEntityHistory(targetType, targetId, query);
  }

  @Get(':id') async findOne(@Param('id') id: string) {
    const log = await this.auditLog.findById(id);
    if (!log) throw new NotFoundException('Audit log not found');
    return log;
  }
}
