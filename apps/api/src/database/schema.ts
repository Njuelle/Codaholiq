import { relations } from 'drizzle-orm';

export * from '../modules/auth/users.schema';
export * from '../modules/organizations/organizations.schema';
export * from '../modules/github/github.schema';
export * from '../modules/automations/automations.schema';
export * from '../modules/executions/executions.schema';
export * from '../modules/audit/audit.schema';
export * from '../modules/variables/variables.schema';
export * from '../modules/notifications/notifications.schema';
export * from '../modules/permissions/permissions.schema';

// --- Relations (defined here to avoid circular imports between modules) ---

import { users, refreshTokens } from '../modules/auth/users.schema';
import { organizations, orgMembers } from '../modules/organizations/organizations.schema';
import { orgRolePermissions } from '../modules/permissions/permissions.schema';
import { githubInstallations, repositories } from '../modules/github/github.schema';
import { automations, automationVariables } from '../modules/automations/automations.schema';
import { executions, executionLogs } from '../modules/executions/executions.schema';
import { auditLogs } from '../modules/audit/audit.schema';
import { sharedVariables } from '../modules/variables/variables.schema';
import { notifications } from '../modules/notifications/notifications.schema';

export const usersRelations = relations(users, ({ many }) => ({
  refreshTokens: many(refreshTokens),
  orgMemberships: many(orgMembers),
  createdAutomations: many(automations),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(orgMembers),
  installations: many(githubInstallations),
  repositories: many(repositories),
  automations: many(automations),
  sharedVariables: many(sharedVariables),
  rolePermissions: many(orgRolePermissions),
}));

export const orgMembersRelations = relations(orgMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [orgMembers.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [orgMembers.userId],
    references: [users.id],
  }),
}));

export const githubInstallationsRelations = relations(githubInstallations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [githubInstallations.orgId],
    references: [organizations.id],
  }),
  repositories: many(repositories),
}));

export const repositoriesRelations = relations(repositories, ({ one, many }) => ({
  installation: one(githubInstallations, {
    fields: [repositories.installationId],
    references: [githubInstallations.id],
  }),
  organization: one(organizations, {
    fields: [repositories.orgId],
    references: [organizations.id],
  }),
  automations: many(automations),
  sharedVariables: many(sharedVariables),
}));

export const automationsRelations = relations(automations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [automations.orgId],
    references: [organizations.id],
  }),
  repository: one(repositories, {
    fields: [automations.repoId],
    references: [repositories.id],
  }),
  creator: one(users, {
    fields: [automations.createdBy],
    references: [users.id],
  }),
  variables: many(automationVariables),
  executions: many(executions),
}));

export const automationVariablesRelations = relations(automationVariables, ({ one }) => ({
  automation: one(automations, {
    fields: [automationVariables.automationId],
    references: [automations.id],
  }),
}));

export const executionsRelations = relations(executions, ({ one, many }) => ({
  automation: one(automations, {
    fields: [executions.automationId],
    references: [automations.id],
  }),
  logs: many(executionLogs),
}));

export const executionLogsRelations = relations(executionLogs, ({ one }) => ({
  execution: one(executions, {
    fields: [executionLogs.executionId],
    references: [executions.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditLogs.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const sharedVariablesRelations = relations(sharedVariables, ({ one }) => ({
  organization: one(organizations, {
    fields: [sharedVariables.orgId],
    references: [organizations.id],
  }),
  repository: one(repositories, {
    fields: [sharedVariables.repoId],
    references: [repositories.id],
  }),
}));

export const orgRolePermissionsRelations = relations(orgRolePermissions, ({ one }) => ({
  organization: one(organizations, {
    fields: [orgRolePermissions.orgId],
    references: [organizations.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  organization: one(organizations, {
    fields: [notifications.orgId],
    references: [organizations.id],
  }),
  execution: one(executions, {
    fields: [notifications.executionId],
    references: [executions.id],
  }),
}));
