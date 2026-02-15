import { z } from 'zod';
import { Permission } from '../permissions.constants';

export const UpdateRolePermissionsSchema = z.object({
  permissions: z.array(z.nativeEnum(Permission)).min(0),
});

export type UpdateRolePermissionsDto = z.infer<typeof UpdateRolePermissionsSchema>;
