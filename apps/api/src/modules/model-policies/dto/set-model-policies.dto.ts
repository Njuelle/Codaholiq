import { z } from 'zod';

const policyEntrySchema = z.object({
  provider: z.string().min(1).max(50),
  model: z.string().min(1).max(100),
});

export const SetModelPoliciesSchema = z.object({
  policies: z.array(policyEntrySchema).max(200),
});

export type SetModelPoliciesDto = z.infer<typeof SetModelPoliciesSchema>;
