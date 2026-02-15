import {
  pgTable,
  serial,
  bigint,
  integer,
  varchar,
  timestamp,
  boolean,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { organizations } from '../organizations/organizations.schema';

export const accountTypeEnum = pgEnum('account_type', ['Organization', 'User']);

export const githubInstallations = pgTable('github_installations', {
  id: serial('id').primaryKey(),
  installationId: bigint('installation_id', { mode: 'number' }).notNull().unique(),
  orgId: integer('org_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  accountLogin: varchar('account_login', { length: 255 }).notNull(),
  accountType: accountTypeEnum('account_type').notNull(),
  suspendedAt: timestamp('suspended_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const repositories = pgTable(
  'repositories',
  {
    id: serial('id').primaryKey(),
    githubId: bigint('github_id', { mode: 'number' }).notNull().unique(),
    installationId: integer('installation_id')
      .notNull()
      .references(() => githubInstallations.id, { onDelete: 'cascade' }),
    orgId: integer('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    owner: varchar('owner', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    fullName: varchar('full_name', { length: 512 }).notNull().unique(),
    defaultBranch: varchar('default_branch', { length: 255 }).notNull(),
    private: boolean('private').notNull().default(false),
    language: varchar('language', { length: 100 }),
    archived: boolean('archived').notNull().default(false),
    webhookActive: boolean('webhook_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('repositories_org_id_idx').on(table.orgId),
    index('repositories_installation_id_idx').on(table.installationId),
  ],
);
