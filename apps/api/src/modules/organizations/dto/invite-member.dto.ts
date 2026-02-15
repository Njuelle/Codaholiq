import { z } from 'zod';

export const InviteMemberSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  role: z.enum(['admin', 'member']).optional().default('member'),
});

export type InviteMemberDto = z.infer<typeof InviteMemberSchema>;
