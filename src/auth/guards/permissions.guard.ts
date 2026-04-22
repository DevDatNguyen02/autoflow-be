import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission, Role, hasPermission } from '../constants/permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Nếu không có @Permissions() decorator, cho phép truy cập
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.role) {
      throw new ForbiddenException('Không có quyền truy cập.');
    }

    const role = user.role as Role;
    const hasAccess = requiredPermissions.every((perm) =>
      hasPermission(role, perm),
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        `Vai trò '${role}' không có quyền thực hiện thao tác này.`,
      );
    }

    return true;
  }
}
