import { z } from 'zod';

export const UpdateRepoSchema = z.object({
  webhookActive: z.boolean(),
});

export type UpdateRepoDto = z.infer<typeof UpdateRepoSchema>;
