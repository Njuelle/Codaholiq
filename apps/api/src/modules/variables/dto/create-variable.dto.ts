import { z } from 'zod';

export const CreateVariableSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_.]+$/, 'Key must contain only letters, numbers, dots, and underscores'),
  value: z.string().min(1).max(10000),
  description: z.string().max(500).optional(),
  repoId: z.number().int().positive().optional(),
});

export type CreateVariableDto = z.infer<typeof CreateVariableSchema>;
