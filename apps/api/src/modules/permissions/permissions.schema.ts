import { pgTable, serial, integer, jsonb, timestamp, unique } from 'drizzle-orm/pg-core';
import { organizations, roleEnum } from '../organizations/organizations.schema';

export const orgRolePermissions = pgTable(
  'org_role_permissions',
  {
    id: serial('id').primaryKey(),
    orgId: integer('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    role: roleEnum('role').notNull(),
    permissions: jsonb('permissions').notNull().$type<string[]>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('org_role_permissions_org_id_role_unique').on(table.orgId, table.role)],
);
