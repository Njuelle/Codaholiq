export const queryKeys = {
  auth: {
    user: () => ['auth', 'user'] as const,
  },
  orgs: {
    all: () => ['orgs'] as const,
    detail: (orgId: number) => ['orgs', orgId] as const,
    members: (orgId: number) => ['orgs', orgId, 'members'] as const,
  },
  repos: {
    all: (orgId: number) => ['orgs', orgId, 'repos'] as const,
    detail: ({ orgId, repoId }: { orgId: number; repoId: number }) =>
      ['orgs', orgId, 'repos', repoId] as const,
    setupStatus: ({ orgId, repoId }: { orgId: number; repoId: number }) =>
      ['orgs', orgId, 'repos', repoId, 'setup-status'] as const,
  },
  automations: {
    all: (orgId: number) => ['orgs', orgId, 'automations'] as const,
    detail: ({ orgId, automationId }: { orgId: number; automationId: number }) =>
      ['orgs', orgId, 'automations', automationId] as const,
  },
  executions: {
    all: (orgId: number) => ['orgs', orgId, 'executions'] as const,
    detail: ({ orgId, executionId }: { orgId: number; executionId: number }) =>
      ['orgs', orgId, 'executions', executionId] as const,
    stats: (orgId: number) => ['orgs', orgId, 'executions', 'stats'] as const,
    logs: ({ orgId, executionId }: { orgId: number; executionId: number }) =>
      ['orgs', orgId, 'executions', executionId, 'logs'] as const,
  },
  variables: {
    all: (orgId: number) => ['orgs', orgId, 'variables'] as const,
  },
  notifications: {
    all: (orgId: number) => ['orgs', orgId, 'notifications'] as const,
  },
  permissions: {
    me: (orgId: number) => ['orgs', orgId, 'permissions', 'me'] as const,
    all: (orgId: number) => ['orgs', orgId, 'permissions'] as const,
  },
  dashboard: {
    stats: (orgId: number) => ['orgs', orgId, 'dashboard'] as const,
  },
  models: {
    all: () => ['models'] as const,
  },
} as const;
