import { pgTable, serial, integer, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { organizations } from '../organizations/organizations.schema';
import { executions } from '../executions/executions.schema';

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    executionId: integer('execution_id')
      .notNull()
      .references(() => executions.id, { onDelete: 'cascade' }),
    automationName: varchar('automation_name', { length: 255 }).notNull(),
    message: text('message').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('notifications_org_id_created_at_idx').on(table.orgId, table.createdAt)],
);
