import { z } from 'zod';
import {
  EventTriggerConfigSchema,
  CronTriggerConfigSchema,
  ManualTriggerConfigSchema,
} from '../dto/trigger-config.dto';
import { PROVIDER_IDS } from '../../providers/providers.registry';

const CatalogVariableSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string(),
  source: z.enum(['static', 'event_payload']),
  required: z.boolean().optional().default(false),
});

const sharedFields = {
  name: z.string().min(1).max(255),
  description: z.string().min(1),
  category: z.string().min(1).max(50),
  icon: z.string().min(1).max(50),
  promptTemplate: z.string().min(1),
  provider: z
    .enum(PROVIDER_IDS, { message: 'Unsupported provider' })
    .optional()
    .default('claude-code'),
  model: z.string().max(100).nullable().optional().default(null),
  variables: z.array(CatalogVariableSchema).optional().default([]),
};

export const CatalogTemplateYamlSchema = z.discriminatedUnion('triggerType', [
  z.object({
    ...sharedFields,
    triggerType: z.literal('event'),
    triggerConfig: EventTriggerConfigSchema,
  }),
  z.object({
    ...sharedFields,
    triggerType: z.literal('cron'),
    triggerConfig: CronTriggerConfigSchema,
  }),
  z.object({
    ...sharedFields,
    triggerType: z.literal('manual'),
    triggerConfig: ManualTriggerConfigSchema,
  }),
]);

export type CatalogTemplateYaml = z.infer<typeof CatalogTemplateYamlSchema>;
