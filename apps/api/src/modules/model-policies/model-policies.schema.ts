import { pgTable, serial, integer, varchar, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { organizations } from '../organizations/organizations.schema';
import { repositories } from '../github/github.schema';
import { users } from '../auth/users.schema';

export const modelPolicies = pgTable(
  'model_policies',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    repoId: integer('repo_id')
      .notNull()
      .references(() => repositories.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 50 }).notNull(),
    model: varchar('model', { length: 100 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: integer('created_by')
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    unique('model_policies_org_repo_provider_model_unique').on(
      table.orgId,
      table.repoId,
      table.provider,
      table.model,
    ),
    index('model_policies_org_repo_idx').on(table.orgId, table.repoId),
  ],
);
