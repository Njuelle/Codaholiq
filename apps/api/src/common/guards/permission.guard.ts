import {
  Injectable,
  Inject,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { PermissionsService } from '../../modules/permissions/permissions.service';
import type { Permission } from '../../modules/permissions/permissions.constants';

@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PermissionsService)
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Express.Request>();
    const orgMember = request.orgMember;

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[] | undefined>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Always resolve and attach permissions when orgMember is present,
    // even without @RequirePermission (service-level checks may need them)
    if (orgMember) {
      const effectivePermissions = await this.permissionsService.resolvePermissions({
        orgId: orgMember.orgId,
        role: orgMember.role,
      });
      request.orgMember = { ...orgMember, permissions: effectivePermissions };

      if (requiredPermissions && requiredPermissions.length > 0) {
        const hasAll = requiredPermissions.every((p) => effectivePermissions.includes(p));
        if (!hasAll) {
          throw new ForbiddenException('Insufficient permissions for this action');
        }
      } else if (!requiredPermissions) {
        const handler = context.getHandler().name;
        const controller = context.getClass().name;
        this.logger.warn(
          `No @RequirePermission on ${controller}.${handler} — endpoint is accessible to all org members`,
        );
      }

      return true;
    }

    // No orgMember — only fail if permissions are actually required
    if (requiredPermissions && requiredPermissions.length > 0) {
      throw new ForbiddenException('Organization membership not resolved');
    }

    return true;
  }
}
