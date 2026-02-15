import { z } from 'zod';

const ConditionOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'matches',
  'exists',
  'not_exists',
]);

const ConditionSchema = z
  .object({
    path: z.string().min(1, 'Path is required').max(200),
    operator: ConditionOperatorSchema,
    value: z.string().max(500).optional(),
  })
  .refine(
    (c) => {
      if (c.operator === 'exists' || c.operator === 'not_exists') return true;
      return c.value !== undefined && c.value.length > 0;
    },
    { message: 'Value is required for this operator' },
  );

const ConditionGroupSchema = z.object({
  conditions: z.array(ConditionSchema).min(1).max(10),
});

export const EventTriggerConfigSchema = z.object({
  events: z
    .array(z.string().min(1, 'Event name must not be empty'))
    .min(1, 'At least one event is required'),
  conditionGroups: z.array(ConditionGroupSchema).max(5).optional(),
});

export type EventTriggerConfigDto = z.infer<typeof EventTriggerConfigSchema>;

const cronRegex = /^(\S+\s+){4,5}\S+$/;

export const CronTriggerConfigSchema = z.object({
  schedule: z.string().min(1, 'Schedule is required').regex(cronRegex, 'Invalid cron expression'),
  timezone: z.string().optional(),
});

export type CronTriggerConfigDto = z.infer<typeof CronTriggerConfigSchema>;

export const ManualTriggerConfigSchema = z.object({});

export type ManualTriggerConfigDto = z.infer<typeof ManualTriggerConfigSchema>;
