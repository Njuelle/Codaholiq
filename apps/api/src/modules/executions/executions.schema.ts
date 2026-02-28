import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  bigint,
  jsonb,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { automations } from '../automations/automations.schema';

export const executionStatusEnum = pgEnum('execution_status', [
  'pending',
  'dispatching',
  'running',
  'completed',
  'failed',
  'cancelled',
  'timed_out',
]);

export const logLevelEnum = pgEnum('log_level', ['info', 'warn', 'error', 'debug']);

export const executions = pgTable(
  'executions',
  {
    id: serial('id').primaryKey(),
    automationId: integer('automation_id')
      .notNull()
      .references(() => automations.id, { onDelete: 'cascade' }),
    status: executionStatusEnum('status').notNull().default('pending'),
    triggerEvent: jsonb('trigger_event'),
    resolvedPrompt: text('resolved_prompt').notNull(),
    provider: varchar('provider', { length: 50 }).notNull().default('claude-code'),
    model: varchar('model', { length: 100 }),
    githubRunId: bigint('github_run_id', { mode: 'number' }),
    githubRunUrl: text('github_run_url'),
    errorMessage: text('error_message'),
    inputTokens: bigint('input_tokens', { mode: 'number' }),
    outputTokens: bigint('output_tokens', { mode: 'number' }),
    totalCostMicros: bigint('total_cost_micros', { mode: 'number' }),
    costCurrency: varchar('cost_currency', { length: 3 }).default('USD'),
    costReportedAt: timestamp('cost_reported_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('executions_automation_id_status_idx').on(table.automationId, table.status),
    index('executions_status_created_at_idx').on(table.status, table.createdAt),
    index('executions_github_run_id_idx').on(table.githubRunId),
    index('executions_created_at_cost_idx').on(table.createdAt, table.totalCostMicros),
  ],
);

export const executionLogs = pgTable(
  'execution_logs',
  {
    id: serial('id').primaryKey(),
    executionId: integer('execution_id')
      .notNull()
      .references(() => executions.id, { onDelete: 'cascade' }),
    level: logLevelEnum('level').notNull(),
    message: text('message').notNull(),
    metadata: jsonb('metadata'),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('execution_logs_execution_id_timestamp_idx').on(table.executionId, table.timestamp),
  ],
);
