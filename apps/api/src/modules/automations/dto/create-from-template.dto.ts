import { z } from 'zod';

export const CreateFromTemplateSchema = z.object({
  templateSlug: z.string().min(1, 'Template slug is required').max(100),
  repoId: z.number().int().positive(),
});

export type CreateFromTemplateDto = z.infer<typeof CreateFromTemplateSchema>;
