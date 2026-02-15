import { z } from 'zod';

export const UpdateVariableSchema = z
  .object({
    value: z.string().min(1).max(10000).optional(),
    description: z.string().max(500).nullable().optional(),
  })
  .refine((data) => data.value !== undefined || data.description !== undefined, {
    message: 'At least one field must be provided',
  });

export type UpdateVariableDto = z.infer<typeof UpdateVariableSchema>;
