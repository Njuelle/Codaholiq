import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  bigint,
  index,
  unique,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { organizations } from '../organizations/organizations.schema';
import { repositories } from '../github/github.schema';
import { users } from '../auth/users.schema';

export const triggerTypeEnum = pgEnum('trigger_type', ['event', 'cron', 'manual']);

export const variableSourceEnum = pgEnum('variable_source', ['static', 'event_payload']);

export const automations = pgTable(
  'automations',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    repoId: integer('repo_id')
      .notNull()
      .references(() => repositories.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    triggerType: triggerTypeEnum('trigger_type').notNull(),
    triggerConfig: jsonb('trigger_config').notNull(),
    promptTemplate: text('prompt_template').notNull(),
    provider: varchar('provider', { length: 50 }).notNull().default('claude-code'),
    model: varchar('model', { length: 100 }),
    workflowFile: varchar('workflow_file', { length: 255 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    monthlyCostLimitMicros: bigint('monthly_cost_limit_micros', { mode: 'number' }),
    createdBy: integer('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('automations_org_id_name_unique').on(table.orgId, table.name),
    index('automations_repo_trigger_enabled_idx').on(
      table.repoId,
      table.triggerType,
      table.enabled,
    ),
    index('automations_trigger_enabled_idx').on(table.triggerType, table.enabled),
  ],
);

/** Hardcoded workflow file — all automations use the same GitHub Actions workflow. */
export const DEFAULT_WORKFLOW_FILE = '.github/workflows/codaholiq.yml';

export const automationVariables = pgTable(
  'automation_variables',
  {
    id: serial('id').primaryKey(),
    automationId: integer('automation_id')
      .notNull()
      .references(() => automations.id, { onDelete: 'cascade' }),
    key: varchar('key', { length: 100 }).notNull(),
    value: text('value').notNull(),
    source: variableSourceEnum('source').notNull(),
    required: boolean('required').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('automation_variables_automation_id_key_unique').on(table.automationId, table.key),
  ],
);
