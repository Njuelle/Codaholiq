import { z } from 'zod';

export const SetEnabledSchema = z.object({
  enabled: z.boolean(),
});

export type SetEnabledDto = z.infer<typeof SetEnabledSchema>;
