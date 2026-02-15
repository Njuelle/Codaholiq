import { z } from 'zod';

export const UpdateMemberRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'member']),
});

export type UpdateMemberRoleDto = z.infer<typeof UpdateMemberRoleSchema>;
