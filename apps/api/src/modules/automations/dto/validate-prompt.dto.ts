import { z } from 'zod';

export const ValidatePromptSchema = z.object({
  promptTemplate: z.string().min(1, 'Prompt template is required'),
  sampleVariables: z.record(z.string(), z.string()).default({}),
});

export type ValidatePromptDto = z.infer<typeof ValidatePromptSchema>;
