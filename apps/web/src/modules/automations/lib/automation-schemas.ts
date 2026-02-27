import { z } from 'zod';

export const variableInputSchema = z.object({
  key: z.string().min(1, 'Key is required').max(100),
  value: z.string(),
  source: z.enum(['static', 'event_payload']),
  required: z.boolean(),
});

const baseFields = {
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().nullable().optional(),
  repoId: z.number({ error: 'Repository is required' }).int().positive('Repository is required'),
  promptTemplate: z.string().min(1, 'Prompt template is required'),
  provider: z.string().min(1, 'Provider is required'),
  model: z.string().nullable(),
  enabled: z.boolean(),
  variables: z.array(variableInputSchema),
};

const conditionOperatorSchema = z.enum([
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

const conditionSchema = z.object({
  path: z.string().min(1, 'Path is required').max(200),
  operator: conditionOperatorSchema,
  value: z.string().max(500).optional(),
});

const conditionGroupSchema = z.object({
  conditions: z.array(conditionSchema).min(1).max(10),
});

export const automationFormSchema = z.discriminatedUnion('triggerType', [
  z.object({
    ...baseFields,
    triggerType: z.literal('event'),
    triggerConfig: z.object({
      events: z
        .array(z.string().min(1, 'Event name must not be empty'))
        .min(1, 'At least one event is required'),
      conditionGroups: z.array(conditionGroupSchema).max(5).optional(),
    }),
  }),
  z.object({
    ...baseFields,
    triggerType: z.literal('cron'),
    triggerConfig: z.object({
      schedule: z
        .string()
        .min(1, 'Schedule is required')
        .regex(/^(\S+\s+){4,5}\S+$/, 'Invalid cron expression'),
      timezone: z.string().optional(),
    }),
  }),
  z.object({
    ...baseFields,
    triggerType: z.literal('manual'),
    triggerConfig: z.object({}),
  }),
]);

export type AutomationFormValues = z.infer<typeof automationFormSchema>;

export const DEFAULT_FORM_VALUES: AutomationFormValues = {
  name: '',
  description: null,
  repoId: 0,
  promptTemplate: '',
  provider: 'claude-code',
  model: null,
  enabled: true,
  variables: [],
  triggerType: 'event',
  triggerConfig: { events: [], conditionGroups: [] },
};
