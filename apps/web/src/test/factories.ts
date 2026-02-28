import type { User } from '@/modules/auth/types';
import type { Organization, OrgMember } from '@/modules/organizations/types';
import type { Repository } from '@/modules/repositories/types';
import type {
  Automation,
  AutomationVariable,
  AutomationWithVariables,
} from '@/modules/automations/types';
import type { Execution, ExecutionLog } from '@/modules/executions/types';
import type { DashboardStats } from '@/modules/dashboard/types';
import type { SharedVariable } from '@/modules/variables/types';
import type { Notification } from '@/modules/notifications/types';
import {
  type MyPermissionsResponse,
  type AllRolePermissions,
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
} from '@/modules/permissions/types';

let idCounter = 1;

function nextId(): number {
  return idCounter++;
}

export function resetFactories(): void {
  idCounter = 1;
}

export function mockUser(overrides?: Partial<User>): User {
  const id = overrides?.id ?? nextId();
  return {
    id,
    username: `user-${id}`,
    email: `user-${id}@example.com`,
    avatarUrl: null,
    ...overrides,
  };
}

export function mockOrg(overrides?: Partial<Organization>): Organization {
  const id = overrides?.id ?? nextId();
  return {
    id,
    name: `Org ${id}`,
    slug: `org-${id}`,
    avatarUrl: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function mockRepo(overrides?: Partial<Repository>): Repository {
  const id = overrides?.id ?? nextId();
  return {
    id,
    githubId: 100000 + id,
    installationId: 1,
    orgId: 1,
    owner: 'test-org',
    name: `repo-${id}`,
    fullName: `test-org/repo-${id}`,
    defaultBranch: 'main',
    private: false,
    language: 'TypeScript',
    archived: false,
    webhookActive: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function mockAutomation(overrides?: Partial<Automation>): Automation {
  const id = overrides?.id ?? nextId();
  return {
    id,
    orgId: 1,
    repoId: 1,
    name: `Automation ${id}`,
    description: null,
    triggerType: 'event',
    triggerConfig: { events: ['push'] },
    promptTemplate: 'Fix the issue in {{file}}',
    provider: 'claude-code',
    model: null,
    workflowFile: '.github/workflows/codaholiq.yml',
    enabled: true,
    createdBy: 1,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function mockAutomationVariable(overrides?: Partial<AutomationVariable>): AutomationVariable {
  const id = overrides?.id ?? nextId();
  return {
    id,
    automationId: 1,
    key: `var_${id}`,
    value: `value-${id}`,
    source: 'static',
    required: false,
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function mockAutomationWithVariables(
  overrides?: Partial<AutomationWithVariables>,
): AutomationWithVariables {
  const automation = mockAutomation(overrides);
  return {
    ...automation,
    variables: overrides?.variables ?? [mockAutomationVariable({ automationId: automation.id })],
  };
}

export function mockExecution(overrides?: Partial<Execution>): Execution {
  const id = overrides?.id ?? nextId();
  return {
    id,
    automationId: 1,
    status: 'completed',
    triggerEvent: null,
    resolvedPrompt: 'Fix the issue in src/main.ts',
    provider: 'claude-code',
    model: null,
    githubRunId: null,
    githubRunUrl: null,
    errorMessage: null,
    inputTokens: null,
    outputTokens: null,
    totalCostMicros: null,
    costCurrency: null,
    costReportedAt: null,
    startedAt: '2025-01-01T00:00:00.000Z',
    completedAt: '2025-01-01T00:01:00.000Z',
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function mockExecutionLog(overrides?: Partial<ExecutionLog>): ExecutionLog {
  const id = overrides?.id ?? nextId();
  return {
    id,
    executionId: 1,
    level: 'info',
    message: `Processing step ${id}...`,
    metadata: null,
    timestamp: '2025-01-01T00:00:05.000Z',
    ...overrides,
  };
}

export function mockOrgMember(overrides?: Partial<OrgMember>): OrgMember {
  const userId = overrides?.userId ?? nextId();
  return {
    userId,
    role: 'member',
    joinedAt: '2025-01-01T00:00:00.000Z',
    username: `user-${userId}`,
    avatarUrl: null,
    ...overrides,
  };
}

export function mockSharedVariable(overrides?: Partial<SharedVariable>): SharedVariable {
  const id = overrides?.id ?? nextId();
  return {
    id,
    orgId: 1,
    repoId: null,
    key: `VAR_${id}`,
    value: `value-${id}`,
    description: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function mockNotification(overrides?: Partial<Notification>): Notification {
  const id = overrides?.id ?? nextId();
  return {
    id,
    orgId: 1,
    executionId: id,
    automationName: `Automation ${id}`,
    message: `Execution #${id} of "Automation ${id}" failed`,
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function mockMyPermissionsResponse(
  overrides?: Partial<MyPermissionsResponse>,
): MyPermissionsResponse {
  return {
    role: 'owner',
    permissions: [...ALL_PERMISSIONS],
    ...overrides,
  };
}

export function mockAllRolePermissions(
  overrides?: Partial<AllRolePermissions>,
): AllRolePermissions {
  return {
    owner: [...ALL_PERMISSIONS],
    admin: [...DEFAULT_ROLE_PERMISSIONS.admin],
    member: [...DEFAULT_ROLE_PERMISSIONS.member],
    ...overrides,
  };
}

const emptyCostStats = {
  totalCostMicros: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  executionsWithCost: 0,
  averageCostMicros: 0,
};

export function mockDashboardStats(overrides?: Partial<DashboardStats>): DashboardStats {
  return {
    recentExecutions: [
      {
        execution: { id: 1, status: 'completed', createdAt: '2025-01-01T00:00:00.000Z' },
        automationName: 'PR Review Bot',
      },
      {
        execution: { id: 2, status: 'failed', createdAt: '2025-01-01T00:01:00.000Z' },
        automationName: 'Nightly Build',
      },
    ],
    executionStats: {
      last24h: { total: 10, completed: 8, failed: 1, running: 1 },
      last7d: { total: 50, completed: 42, failed: 5, running: 3 },
      last30d: { total: 200, completed: 180, failed: 15, running: 5 },
    },
    costStats: {
      last24h: emptyCostStats,
      last7d: emptyCostStats,
      last30d: emptyCostStats,
    },
    costByProvider: [],
    topCostliestAutomations: [],
    activeAutomationsCount: 5,
    repositoryCount: 3,
    upcomingCronTriggers: [
      {
        automationId: 1,
        automationName: 'Nightly Build',
        nextFireAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
    ],
    ...overrides,
  };
}
