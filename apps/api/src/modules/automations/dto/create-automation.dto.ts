import { z } from 'zod';
import {
  EventTriggerConfigSchema,
  CronTriggerConfigSchema,
  ManualTriggerConfigSchema,
} from './trigger-config.dto';
import { SUPPORTED_MODEL_IDS } from '../models.constants';

const modelSchema = z
  .string()
  .max(100)
  .refine((val) => SUPPORTED_MODEL_IDS.includes(val), { message: 'Unsupported model' })
  .nullable()
  .optional()
  .default(null);

const VariableSchema = z.object({
  key: z.string().min(1, 'Key is required').max(100),
  value: z.string(),
  source: z.enum(['static', 'event_payload']),
  required: z.boolean().optional().default(false),
});

const baseFields = {
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().nullable().optional(),
  repoId: z.number().int().positive(),
  promptTemplate: z.string().min(1, 'Prompt template is required'),
  model: modelSchema,
  enabled: z.boolean().optional().default(true),
  variables: z.array(VariableSchema).optional().default([]),
};

export const AutomationCreateSchema = z.discriminatedUnion('triggerType', [
  z.object({
    ...baseFields,
    triggerType: z.literal('event'),
    triggerConfig: EventTriggerConfigSchema,
  }),
  z.object({
    ...baseFields,
    triggerType: z.literal('cron'),
    triggerConfig: CronTriggerConfigSchema,
  }),
  z.object({
    ...baseFields,
    triggerType: z.literal('manual'),
    triggerConfig: ManualTriggerConfigSchema,
  }),
]);

export type AutomationCreateDto = z.infer<typeof AutomationCreateSchema>;
