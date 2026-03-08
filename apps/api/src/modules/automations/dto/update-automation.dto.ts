import { z } from 'zod';
import {
  EventTriggerConfigSchema,
  CronTriggerConfigSchema,
  ManualTriggerConfigSchema,
} from './trigger-config.dto';
import { PROVIDER_IDS } from '../../providers/providers.registry';

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
    provider: z.enum(PROVIDER_IDS, { message: 'Unsupported provider' }).optional(),
    model: z.string().max(100).nullable().optional(),
    enabled: z.boolean().optional(),
    monthlyCostLimitMicros: z
      .number()
      .int()
      .positive()
      .max(100_000_000_000, 'Cost limit cannot exceed $100,000')
      .nullable()
      .optional(),
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
