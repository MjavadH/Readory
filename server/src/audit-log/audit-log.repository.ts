import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogInput } from './interfaces/audit-log.interface';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@Injectable()
export class AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: AuditLogInput & { diff?: unknown }) { return (this.prisma as any).auditLog.create({ data }); }
  findById(id: string) { return (this.prisma as any).auditLog.findUnique({ where: { id } }); }

  async findMany(query: AuditLogQueryDto) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const where: any = {};
    if (query.from || query.to) where.createdAt = { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) };
    if (query.actorId) where.actorId = String(query.actorId);
    if (query.action) where.action = query.action;
    if (query.category) where.category = query.category;
    if (query.targetType) where.targetType = query.targetType;
    if (query.targetId) where.targetId = String(query.targetId);
    if (query.severity) where.severity = query.severity;
    if (query.search) where.OR = ['actorName', 'targetName', 'targetId', 'requestId'].map((field) => ({ [field]: { contains: query.search, mode: 'insensitive' } }));
    const orderBy = { [query.sortBy || 'createdAt']: query.sortOrder || 'desc' };
    const [data, total] = await Promise.all([
      (this.prisma as any).auditLog.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit }),
      (this.prisma as any).auditLog.count({ where }),
    ]);
    return { data, total, page, limit, lastPage: Math.ceil(total / limit) };
  }
}
