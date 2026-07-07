import { SetMetadata } from '@nestjs/common';
import { AUDIT_LOG_METADATA_KEY } from '../constants/audit-log.constants';
import { AuditLogDecoratorOptions } from '../interfaces/audit-log.interface';
export const Audit = (options: AuditLogDecoratorOptions) =>
  SetMetadata(AUDIT_LOG_METADATA_KEY, options);
