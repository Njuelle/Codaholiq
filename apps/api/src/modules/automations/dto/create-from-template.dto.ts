import { z } from 'zod';
import { PROVIDER_IDS } from '../../providers/providers.registry';

export const CreateFromTemplateSchema = z.object({
  templateSlug: z.string().min(1, 'Template slug is required').max(100),
  repoId: z.number().int().positive(),
  provider: z.enum(PROVIDER_IDS, { message: 'Unsupported provider' }).optional(),
  model: z.string().max(100).nullable().optional(),
});

export type CreateFromTemplateDto = z.infer<typeof CreateFromTemplateSchema>;
