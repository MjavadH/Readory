import { SetMetadata } from '@nestjs/common';
import type { AdminPermissions } from './permissions.enum';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: AdminPermissions[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
