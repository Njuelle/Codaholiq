import { z } from 'zod';

export const ListExecutionsQuerySchema = z.object({
  status: z
    .enum(['pending', 'dispatching', 'running', 'completed', 'failed', 'cancelled', 'timed_out'])
    .optional(),
  automationId: z.coerce.number().int().positive().optional(),
  repoId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

export type ListExecutionsQuery = z.infer<typeof ListExecutionsQuerySchema>;
