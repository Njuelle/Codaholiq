import { z } from 'zod';
import {
  EventTriggerConfigSchema,
  CronTriggerConfigSchema,
  ManualTriggerConfigSchema,
} from './trigger-config.dto';
import { SUPPORTED_MODEL_IDS } from '../models.constants';

const triggerPairSchema = z.discriminatedUnion('triggerType', [
  z.object({
    triggerType: z.literal('event'),
    triggerConfig: EventTriggerConfigSchema,
  }),
  z.object({
    triggerType: z.literal('cron'),
    triggerConfig: CronTriggerConfigSchema,
  }),
  z.object({
    triggerType: z.literal('manual'),
    triggerConfig: ManualTriggerConfigSchema,
  }),
]);

export const AutomationUpdateSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().nullable().optional(),
    promptTemplate: z.string().min(1).optional(),
    model: z
      .string()
      .max(100)
      .refine((val) => SUPPORTED_MODEL_IDS.includes(val), { message: 'Unsupported model' })
      .nullable()
      .optional(),
    enabled: z.boolean().optional(),
  })
  .and(
    triggerPairSchema.or(
      z.object({
        triggerType: z.undefined(),
        triggerConfig: z.undefined(),
      }),
    ),
  );

export type AutomationUpdateDto = z.infer<typeof AutomationUpdateSchema>;
