import { z } from 'zod';

export const ListAutomationsQuerySchema = z.object({
  triggerType: z.enum(['event', 'cron', 'manual']).optional(),
  enabled: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  repoId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

export type ListAutomationsQuery = z.infer<typeof ListAutomationsQuerySchema>;
