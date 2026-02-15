import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../../modules/permissions/permissions.constants';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermission = (...permissions: Permission[]): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_KEY, permissions);
