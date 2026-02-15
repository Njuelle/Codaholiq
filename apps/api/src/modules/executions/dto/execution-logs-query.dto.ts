import { z } from 'zod';

export const ExecutionLogsQuerySchema = z.object({
  after: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

export type ExecutionLogsQuery = z.infer<typeof ExecutionLogsQuerySchema>;
