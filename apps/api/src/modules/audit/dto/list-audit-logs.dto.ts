import { z } from 'zod';

export const ListAuditLogsQuerySchema = z.object({
  action: z.string().optional(),
  userId: z.coerce.number().int().positive().optional(),
  resourceType: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type ListAuditLogsQuery = z.infer<typeof ListAuditLogsQuerySchema>;
