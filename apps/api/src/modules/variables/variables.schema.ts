import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { organizations } from '../organizations/organizations.schema';
import { repositories } from '../github/github.schema';

export const sharedVariables = pgTable(
  'shared_variables',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    repoId: integer('repo_id').references(() => repositories.id, {
      onDelete: 'cascade',
    }),
    key: varchar('key', { length: 100 }).notNull(),
    value: text('value').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('shared_variables_org_repo_key_unique').on(table.orgId, table.repoId, table.key),
    index('shared_variables_org_id_idx').on(table.orgId),
    index('shared_variables_org_repo_idx').on(table.orgId, table.repoId),
  ],
);
