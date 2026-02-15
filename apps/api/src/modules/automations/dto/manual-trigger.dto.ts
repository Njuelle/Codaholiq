import { z } from 'zod';

export const ManualTriggerSchema = z.object({
  variables: z.record(z.string()).optional(),
});

export type ManualTriggerDto = z.infer<typeof ManualTriggerSchema>;
