import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { AdminPermissions } from './permissions.enum';

@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        private configService: ConfigService
    ) {}

    canActivate(context: ExecutionContext): boolean {
        const requiredPermissions = this.reflector.getAllAndOverride<AdminPermissions[]>(PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!requiredPermissions) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest();

        if (!user) return false;

        const superAdminId = Number(this.configService.get<number>('SUPER_ADMIN_ID'));
        if (user.userId === superAdminId) {
            return true;
        }
        const hasPermission = requiredPermissions.some((permission) =>
            user.permissions?.includes(permission),
        );

        if (!hasPermission) {
            throw new ForbiddenException('You do not have permission to access this resource.');
        }

        return true;
    }
}