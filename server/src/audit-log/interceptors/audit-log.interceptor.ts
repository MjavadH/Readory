import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { tap } from 'rxjs/operators';
import { AuditAction } from '@readory/shared';
import { AUDIT_LOG_METADATA_KEY } from '../constants/audit-log.constants';
import { AuditLogService } from '../audit-log.service';
import { AuditLogDecoratorOptions } from '../interfaces/audit-log.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { ensureAuditRequestMetadata } from '../utils/audit-request.util';
import {
  getTargetIdFromRequest,
  loadAuditTarget,
  targetName,
} from '../utils/audit-target-resolver.util';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);
  constructor(
    private readonly reflector: Reflector,
    private readonly auditLog: AuditLogService,
    private readonly prisma: PrismaService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const meta = this.reflector.getAllAndOverride<AuditLogDecoratorOptions>(
      AUDIT_LOG_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!meta) return next.handle();
    const req = context.switchToHttp().getRequest();
    if (meta.adminOnly && req.user?.roleName !== 'ADMIN' && req.user?.role !== 'ADMIN')
      return next.handle();
    const requestMeta = ensureAuditRequestMetadata(req);
    const idFromReq = meta.targetIdParam
      ? req.params?.[meta.targetIdParam]
      : getTargetIdFromRequest(req);
    const targetId = idFromReq ?? meta.getTargetId?.(undefined, req);
    let before: unknown = null;
    try {
      if (req.method !== 'POST')
        before = await loadAuditTarget(this.prisma, meta.targetType, targetId);
    } catch (error) {
      this.logger.warn(`Unable to load audit before snapshot: ${(error as Error).message}`);
    }
    return next.handle().pipe(
      tap((result) => {
        const resolvedTargetId = meta.getTargetId?.(result, req) ?? result?.id ?? targetId;
        const action =
          meta.action === AuditAction.USER_BANNED && req.body?.isBanned === false
            ? AuditAction.USER_UNBANNED
            : meta.action;
        this.auditLog.log({
          action,
          category: meta.category,
          severity: meta.severity,
          actorId: req.user?.userId ?? req.user?.id,
          actorName: req.user?.username ?? req.user?.email,
          actorRole: req.user?.roleName ?? req.user?.role,
          ...requestMeta,
          targetType: meta.targetType,
          targetId: resolvedTargetId,
          targetName: meta.getTargetName?.(result, req) ?? targetName(result) ?? targetName(before),
          metadata: {
            method: req.method,
            path: req.originalUrl ?? req.url,
            params: req.params,
            query: req.query,
          },
          before: req.method === 'POST' ? null : before,
          after: req.method === 'DELETE' ? null : result,
        });
      }),
    );
  }
}
