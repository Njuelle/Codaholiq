import {
  users,
  refreshTokens,
  organizations,
  orgMembers,
  githubInstallations,
  repositories,
  automations,
  automationVariables,
  executions,
  executionLogs,
  auditLogs,
  sharedVariables,
  notifications,
} from '../schema';
import type { TestDatabase } from './test-database';

let userCounter = 0;
let orgCounter = 0;
let installationCounter = 0;
let repoCounter = 0;
let automationCounter = 0;
let executionCounter = 0;
let sharedVariableCounter = 0;

export function resetCounters(): void {
  userCounter = 0;
  orgCounter = 0;
  installationCounter = 0;
  repoCounter = 0;
  automationCounter = 0;
  executionCounter = 0;
  sharedVariableCounter = 0;
}

export async function createUser(
  db: TestDatabase,
  overrides: Partial<typeof users.$inferInsert> = {},
): Promise<typeof users.$inferSelect> {
  userCounter++;
  const [user] = await db
    .insert(users)
    .values({
      githubId: overrides.githubId ?? 100000 + userCounter,
      username: overrides.username ?? `testuser-${userCounter}`,
      email: overrides.email ?? `testuser-${userCounter}@example.com`,
      avatarUrl: overrides.avatarUrl ?? null,
      ...overrides,
    })
    .returning();
  return user;
}

export async function createOrg(
  db: TestDatabase,
  overrides: Partial<typeof organizations.$inferInsert> = {},
): Promise<typeof organizations.$inferSelect> {
  orgCounter++;
  const [org] = await db
    .insert(organizations)
    .values({
      name: overrides.name ?? `Test Org ${orgCounter}`,
      slug: overrides.slug ?? `test-org-${orgCounter}`,
      avatarUrl: overrides.avatarUrl ?? null,
      ...overrides,
    })
    .returning();
  return org;
}

export async function createOrgMember(
  db: TestDatabase,
  values: {
    orgId: number;
    userId: number;
    role?: 'owner' | 'admin' | 'member';
  },
): Promise<typeof orgMembers.$inferSelect> {
  const [member] = await db
    .insert(orgMembers)
    .values({
      orgId: values.orgId,
      userId: values.userId,
      role: values.role ?? 'member',
    })
    .returning();
  return member;
}

export async function createRefreshToken(
  db: TestDatabase,
  values: {
    userId: number;
    tokenHash: string;
    expiresAt: Date;
    revokedAt?: Date | null;
  },
): Promise<typeof refreshTokens.$inferSelect> {
  const [token] = await db
    .insert(refreshTokens)
    .values({
      userId: values.userId,
      tokenHash: values.tokenHash,
      expiresAt: values.expiresAt,
      revokedAt: values.revokedAt ?? null,
    })
    .returning();
  return token;
}

export async function createInstallation(
  db: TestDatabase,
  values: {
    orgId: number;
    installationId?: number;
    accountLogin?: string;
    accountType?: 'Organization' | 'User';
  },
): Promise<typeof githubInstallations.$inferSelect> {
  installationCounter++;
  const [installation] = await db
    .insert(githubInstallations)
    .values({
      installationId: values.installationId ?? 200000 + installationCounter,
      orgId: values.orgId,
      accountLogin: values.accountLogin ?? `test-account-${installationCounter}`,
      accountType: values.accountType ?? 'Organization',
    })
    .returning();
  return installation;
}

export async function createRepository(
  db: TestDatabase,
  values: {
    installationId: number;
    orgId: number;
    githubId?: number;
    owner?: string;
    name?: string;
    fullName?: string;
    defaultBranch?: string;
    private?: boolean;
    language?: string | null;
    archived?: boolean;
    webhookActive?: boolean;
  },
): Promise<typeof repositories.$inferSelect> {
  repoCounter++;
  const repoOwner = values.owner ?? `test-owner-${repoCounter}`;
  const repoName = values.name ?? `test-repo-${repoCounter}`;
  const [repo] = await db
    .insert(repositories)
    .values({
      githubId: values.githubId ?? 300000 + repoCounter,
      installationId: values.installationId,
      orgId: values.orgId,
      owner: repoOwner,
      name: repoName,
      fullName: values.fullName ?? `${repoOwner}/${repoName}`,
      defaultBranch: values.defaultBranch ?? 'main',
      private: values.private ?? false,
      language: values.language ?? null,
      archived: values.archived ?? false,
      webhookActive: values.webhookActive ?? true,
    })
    .returning();
  return repo;
}

export async function createAutomation(
  db: TestDatabase,
  values: {
    orgId: number;
    repoId: number;
    createdBy: number;
    name?: string;
    triggerType?: 'event' | 'cron' | 'manual';
    triggerConfig?: Record<string, unknown>;
    promptTemplate?: string;
    workflowFile?: string;
    enabled?: boolean;
    description?: string | null;
  },
): Promise<typeof automations.$inferSelect> {
  automationCounter++;
  const [automation] = await db
    .insert(automations)
    .values({
      orgId: values.orgId,
      repoId: values.repoId,
      createdBy: values.createdBy,
      name: values.name ?? `Test Automation ${automationCounter}`,
      description: values.description ?? null,
      triggerType: values.triggerType ?? 'manual',
      triggerConfig: values.triggerConfig ?? {},
      promptTemplate: values.promptTemplate ?? `Test prompt template ${automationCounter}`,
      workflowFile: values.workflowFile ?? '.github/workflows/codaholiq.yml',
      enabled: values.enabled ?? true,
    })
    .returning();
  return automation;
}

export async function createAutomationVariable(
  db: TestDatabase,
  values: {
    automationId: number;
    key: string;
    value: string;
    source?: 'static' | 'event_payload';
    required?: boolean;
  },
): Promise<typeof automationVariables.$inferSelect> {
  const [variable] = await db
    .insert(automationVariables)
    .values({
      automationId: values.automationId,
      key: values.key,
      value: values.value,
      source: values.source ?? 'static',
      required: values.required ?? false,
    })
    .returning();
  return variable;
}

export async function createExecution(
  db: TestDatabase,
  values: {
    automationId: number;
    status?:
      | 'pending'
      | 'dispatching'
      | 'running'
      | 'completed'
      | 'failed'
      | 'cancelled'
      | 'timed_out';
    resolvedPrompt?: string;
    triggerEvent?: Record<string, unknown> | null;
    githubRunId?: number | null;
    githubRunUrl?: string | null;
    errorMessage?: string | null;
  },
): Promise<typeof executions.$inferSelect> {
  executionCounter++;
  const [execution] = await db
    .insert(executions)
    .values({
      automationId: values.automationId,
      status: values.status ?? 'pending',
      resolvedPrompt: values.resolvedPrompt ?? `Resolved prompt ${executionCounter}`,
      triggerEvent: values.triggerEvent ?? null,
      githubRunId: values.githubRunId ?? null,
      githubRunUrl: values.githubRunUrl ?? null,
      errorMessage: values.errorMessage ?? null,
    })
    .returning();
  return execution;
}

export async function createExecutionLog(
  db: TestDatabase,
  values: {
    executionId: number;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    metadata?: Record<string, unknown> | null;
  },
): Promise<typeof executionLogs.$inferSelect> {
  const [log] = await db
    .insert(executionLogs)
    .values({
      executionId: values.executionId,
      level: values.level,
      message: values.message,
      metadata: values.metadata ?? null,
    })
    .returning();
  return log;
}

export async function createAuditLog(
  db: TestDatabase,
  values: {
    orgId?: number | null;
    userId?: number | null;
    action: typeof auditLogs.$inferInsert.action;
    resourceType: string;
    resourceId?: string | null;
    details?: Record<string, unknown> | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  },
): Promise<typeof auditLogs.$inferSelect> {
  const [auditLog] = await db
    .insert(auditLogs)
    .values({
      orgId: values.orgId ?? null,
      userId: values.userId ?? null,
      action: values.action,
      resourceType: values.resourceType,
      resourceId: values.resourceId ?? null,
      details: values.details ?? null,
      ipAddress: values.ipAddress ?? null,
      userAgent: values.userAgent ?? null,
    })
    .returning();
  return auditLog;
}

export async function createSharedVariable(
  db: TestDatabase,
  values: {
    orgId: number;
    repoId?: number | null;
    key?: string;
    value?: string;
    description?: string | null;
  },
): Promise<typeof sharedVariables.$inferSelect> {
  sharedVariableCounter++;
  const [variable] = await db
    .insert(sharedVariables)
    .values({
      orgId: values.orgId,
      repoId: values.repoId ?? null,
      key: values.key ?? `shared_var_${sharedVariableCounter}`,
      value: values.value ?? `shared-value-${sharedVariableCounter}`,
      description: values.description ?? null,
    })
    .returning();
  return variable;
}

export async function createNotification(
  db: TestDatabase,
  values: {
    orgId: number;
    executionId: number;
    automationName?: string;
    message?: string;
  },
): Promise<typeof notifications.$inferSelect> {
  const [notification] = await db
    .insert(notifications)
    .values({
      orgId: values.orgId,
      executionId: values.executionId,
      automationName: values.automationName ?? 'Test Automation',
      message: values.message ?? 'Execution failed',
    })
    .returning();
  return notification;
}
