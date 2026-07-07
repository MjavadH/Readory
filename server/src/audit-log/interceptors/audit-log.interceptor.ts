import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { tap } from 'rxjs/operators';
import { AUDIT_LOG_METADATA_KEY } from '../constants/audit-log.constants';
import { AuditLogService } from '../audit-log.service';
import { AuditLogDecoratorOptions } from '../interfaces/audit-log.interface';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector, private readonly auditLog: AuditLogService) {}
  intercept(context: ExecutionContext, next: CallHandler) {
    const meta = this.reflector.getAllAndOverride<AuditLogDecoratorOptions>(AUDIT_LOG_METADATA_KEY, [context.getHandler(), context.getClass()]);
    if (!meta) return next.handle();
    const req = context.switchToHttp().getRequest();
    return next.handle().pipe(tap((result) => this.auditLog.log({
      action: meta.action, category: meta.category, severity: meta.severity,
      actorId: req.user?.userId ?? req.user?.id, actorName: req.user?.username, actorRole: req.user?.roleName,
      ipAddress: req.ip ?? req.headers['x-forwarded-for'], userAgent: req.headers['user-agent'], requestId: req.headers['x-request-id'],
      targetType: meta.targetType, targetId: meta.getTargetId?.(result, req) ?? (result as any)?.id, targetName: meta.getTargetName?.(result, req) ?? (result as any)?.name ?? (result as any)?.title,
      metadata: { method: req.method, path: req.originalUrl ?? req.url }, after: result,
    })));
  }
}
