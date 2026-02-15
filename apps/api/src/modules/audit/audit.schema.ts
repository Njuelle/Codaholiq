import {
  pgTable,
  serial,
  integer,
  pgEnum,
  varchar,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { organizations } from '../organizations/organizations.schema';
import { users } from '../auth/users.schema';

export const auditActionEnum = pgEnum('audit_action', [
  'automation.created',
  'automation.updated',
  'automation.deleted',
  'automation.enabled',
  'automation.disabled',
  'automation.triggered',
  'execution.cancelled',
  'execution.retried',
  'member.invited',
  'member.role_updated',
  'member.removed',
  'org.updated',
  'auth.login',
  'auth.logout',
]);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),
    userId: integer('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    action: auditActionEnum('action').notNull(),
    resourceType: varchar('resource_type', { length: 50 }).notNull(),
    resourceId: varchar('resource_id', { length: 255 }),
    details: jsonb('details').$type<Record<string, unknown>>(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: varchar('user_agent', { length: 512 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('audit_logs_org_created_idx').on(table.orgId, table.createdAt),
    index('audit_logs_action_idx').on(table.action),
    index('audit_logs_user_idx').on(table.userId),
  ],
);
