import { z } from 'zod';

export const ListReposQuerySchema = z.object({
  search: z.string().max(255).optional(),
  language: z.string().max(100).optional(),
  archived: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

export type ListReposQuery = z.infer<typeof ListReposQuerySchema>;
