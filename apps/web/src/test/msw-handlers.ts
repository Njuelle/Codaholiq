import { http, HttpResponse } from 'msw';
import {
  mockOrg,
  mockAutomation,
  mockAutomationWithVariables,
  mockRepo,
  mockExecution,
  mockExecutionLog,
  mockDashboardStats,
  mockOrgMember,
  mockSharedVariable,
  mockMyPermissionsResponse,
  mockAllRolePermissions,
} from './factories';

export const defaultHandlers = [
  http.post('/api/auth/refresh', () => {
    return HttpResponse.json({
      data: {
        accessToken: 'new-access-token',
      },
      requestId: 'test-request-id',
    });
  }),

  http.post('/api/auth/logout', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.get('/api/orgs', () => {
    return HttpResponse.json({
      data: [mockOrg({ id: 1, name: 'Test Org', slug: 'test-org' })],
      requestId: 'test-request-id',
    });
  }),

  http.get('/api/orgs/:orgId/automations', () => {
    return HttpResponse.json({
      data: [
        mockAutomation({ id: 1, name: 'Test Automation' }),
        mockAutomation({
          id: 2,
          name: 'Cron Automation',
          triggerType: 'cron',
          triggerConfig: { schedule: '0 9 * * 1-5' },
        }),
      ],
      requestId: 'test-request-id',
    });
  }),

  http.get('/api/orgs/:orgId/automations/:automationId', () => {
    return HttpResponse.json({
      data: mockAutomationWithVariables({ id: 1, name: 'Test Automation' }),
      requestId: 'test-request-id',
    });
  }),

  http.post('/api/orgs/:orgId/automations', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      data: mockAutomationWithVariables({
        id: 100,
        name: body.name as string,
        variables: [],
      }),
      requestId: 'test-request-id',
    });
  }),

  http.patch('/api/orgs/:orgId/automations/:automationId', () => {
    return HttpResponse.json({
      data: mockAutomation({ id: 1 }),
      requestId: 'test-request-id',
    });
  }),

  http.delete('/api/orgs/:orgId/automations/:automationId', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.patch('/api/orgs/:orgId/automations/:automationId/enabled', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('/api/orgs/:orgId/automations/:automationId/trigger', () => {
    return HttpResponse.json({
      data: { executionId: 42, status: 'pending' },
      requestId: 'test-request-id',
    });
  }),

  http.post('/api/orgs/:orgId/automations/:automationId/validate-prompt', () => {
    return HttpResponse.json({
      data: {
        resolvedPrompt: 'Resolved prompt text',
        variables: ['file', 'branch'],
      },
      requestId: 'test-request-id',
    });
  }),

  http.get('/api/orgs/:orgId/repos', () => {
    return HttpResponse.json({
      data: {
        items: [
          mockRepo({ id: 1, name: 'repo-1', fullName: 'test-org/repo-1' }),
          mockRepo({ id: 2, name: 'repo-2', fullName: 'test-org/repo-2' }),
        ],
        meta: { total: 2, limit: 100, offset: 0 },
      },
      requestId: 'test-request-id',
    });
  }),

  http.get('/api/orgs/:orgId/executions', () => {
    return HttpResponse.json({
      data: {
        items: [
          {
            execution: mockExecution({ id: 1, status: 'completed' }),
            automationName: 'Test Automation',
          },
        ],
        meta: { total: 1, limit: 5, offset: 0 },
      },
      requestId: 'test-request-id',
    });
  }),

  http.get('/api/models', () => {
    return HttpResponse.json({
      models: [
        {
          id: 'claude-sonnet-4-5-20250929',
          name: 'Claude Sonnet 4.5',
          description: 'Balanced speed and capability',
        },
        {
          id: 'claude-opus-4-6',
          name: 'Claude Opus 4.6',
          description: 'Most capable, best for complex tasks',
        },
        {
          id: 'claude-haiku-4-5-20251001',
          name: 'Claude Haiku 4.5',
          description: 'Fastest and most cost-effective',
        },
      ],
      defaultModelId: 'claude-sonnet-4-5-20250929',
    });
  }),

  http.get('/api/providers', () => {
    return HttpResponse.json({
      data: {
        providers: [
          {
            id: 'claude-code',
            name: 'Claude Code',
            description: 'Anthropic Claude Code Action',
            models: [
              {
                id: 'claude-sonnet-4-5-20250929',
                name: 'Claude Sonnet 4.5',
                description: 'Balanced speed and capability',
              },
              {
                id: 'claude-opus-4-6',
                name: 'Claude Opus 4.6',
                description: 'Most capable',
              },
            ],
            defaultModelId: 'claude-sonnet-4-5-20250929',
            secrets: [
              { name: 'ANTHROPIC_API_KEY', required: false, description: 'Anthropic API key' },
            ],
          },
          {
            id: 'codex',
            name: 'OpenAI Codex',
            description: 'OpenAI Codex coding agent',
            models: [
              { id: 'codex-mini', name: 'Codex Mini', description: 'Fast and cost-effective' },
              { id: 'o4-mini', name: 'o4-mini', description: 'General purpose reasoning model' },
            ],
            defaultModelId: 'codex-mini',
            secrets: [{ name: 'OPENAI_API_KEY', required: true, description: 'OpenAI API key' }],
          },
        ],
        defaultProviderId: 'claude-code',
      },
      requestId: 'test-request-id',
    });
  }),

  http.get('/api/workflow-template', () => {
    return HttpResponse.json({
      data: {
        template:
          'name: Codaholiq\n\non:\n  workflow_dispatch:\n    inputs:\n      prompt:\n        description: The prompt to send to Claude Code\n        required: true\n        type: string\n\njobs:\n  execute:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: anthropics/claude-code-action@v1\n        with:\n          prompt: ${{ github.event.inputs.prompt }}\n          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}\n',
      },
      requestId: 'test-request-id',
    });
  }),

  // Dashboard
  http.get('/api/orgs/:orgId/dashboard', () => {
    return HttpResponse.json({
      data: mockDashboardStats(),
      requestId: 'test-request-id',
    });
  }),

  // Execution detail
  http.get('/api/orgs/:orgId/executions/stats', () => {
    return HttpResponse.json({
      data: { byStatus: [{ status: 'completed', count: 5 }] },
      requestId: 'test-request-id',
    });
  }),

  http.get('/api/orgs/:orgId/executions/:executionId/logs', () => {
    return HttpResponse.json({
      data: [
        mockExecutionLog({ id: 1, message: 'Starting execution...' }),
        mockExecutionLog({ id: 2, level: 'warn', message: 'Slow response' }),
      ],
      requestId: 'test-request-id',
    });
  }),

  http.get('/api/orgs/:orgId/executions/:executionId', () => {
    return HttpResponse.json({
      data: {
        execution: mockExecution({ id: 1, status: 'completed' }),
        automationName: 'Test Automation',
      },
      requestId: 'test-request-id',
    });
  }),

  http.post('/api/orgs/:orgId/executions/:executionId/cancel', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('/api/orgs/:orgId/executions/:executionId/retry', () => {
    return HttpResponse.json({
      data: { execution: mockExecution({ id: 99, status: 'pending' }) },
      requestId: 'test-request-id',
    });
  }),

  // Org members
  http.get('/api/orgs/:orgId/members', () => {
    return HttpResponse.json({
      data: [
        mockOrgMember({ userId: 1, username: 'owner-user', role: 'owner' }),
        mockOrgMember({ userId: 2, username: 'member-user', role: 'member' }),
      ],
      requestId: 'test-request-id',
    });
  }),

  http.patch('/api/orgs/:orgId/members/:userId', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete('/api/orgs/:orgId/members/:userId', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Shared variables
  http.get('/api/orgs/:orgId/variables', () => {
    return HttpResponse.json({
      data: [
        mockSharedVariable({
          id: 1,
          key: 'API_URL',
          value: 'https://api.example.com',
          description: 'API base URL',
        }),
        mockSharedVariable({ id: 2, key: 'DEPLOY_ENV', value: 'staging', repoId: 1 }),
      ],
      requestId: 'test-request-id',
    });
  }),

  http.post('/api/orgs/:orgId/variables', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      data: mockSharedVariable({
        id: 100,
        key: body.key as string,
        value: body.value as string,
      }),
      requestId: 'test-request-id',
    });
  }),

  http.patch('/api/orgs/:orgId/variables/:variableId', () => {
    return HttpResponse.json({
      data: mockSharedVariable({ id: 1 }),
      requestId: 'test-request-id',
    });
  }),

  http.delete('/api/orgs/:orgId/variables/:variableId', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Notifications
  http.get('/api/orgs/:orgId/notifications', () => {
    return HttpResponse.json({
      data: [],
      requestId: 'test-request-id',
    });
  }),

  http.delete('/api/orgs/:orgId/notifications/:notificationId', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Permissions
  http.get('/api/orgs/:orgId/permissions/me', () => {
    return HttpResponse.json({
      data: mockMyPermissionsResponse(),
      requestId: 'test-request-id',
    });
  }),

  http.get('/api/orgs/:orgId/permissions', () => {
    return HttpResponse.json({
      data: mockAllRolePermissions(),
      requestId: 'test-request-id',
    });
  }),

  http.put('/api/orgs/:orgId/permissions/:role', () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // Repo sync & detail
  http.post('/api/orgs/:orgId/repos/sync', () => {
    return HttpResponse.json({
      data: { synced: 5 },
      requestId: 'test-request-id',
    });
  }),

  http.post('/api/orgs/:orgId/repos/:repoId/setup-workflow', () => {
    return HttpResponse.json(
      {
        data: { pullRequestUrl: 'https://github.com/test-org/repo-1/pull/1' },
        requestId: 'test-request-id',
      },
      { status: 201 },
    );
  }),

  http.get('/api/orgs/:orgId/repos/:repoId/setup-status', () => {
    return HttpResponse.json({
      data: {
        workflowFileExists: true,
        secretsConfigured: true,
        hasAnthropicKey: true,
        hasOAuthToken: false,
        providerSecrets: [
          {
            providerId: 'claude-code',
            providerName: 'Claude Code',
            configured: true,
            secrets: [{ name: 'ANTHROPIC_API_KEY', exists: true }],
          },
          {
            providerId: 'codex',
            providerName: 'OpenAI Codex',
            configured: false,
            secrets: [{ name: 'OPENAI_API_KEY', exists: false }],
          },
        ],
      },
      requestId: 'test-request-id',
    });
  }),

  http.get('/api/orgs/:orgId/repos/:repoId', () => {
    return HttpResponse.json({
      data: { repo: mockRepo({ id: 1 }), automationCount: 3 },
      requestId: 'test-request-id',
    });
  }),

  http.patch('/api/orgs/:orgId/repos/:repoId', () => {
    return HttpResponse.json({
      data: mockRepo({ id: 1, webhookActive: false }),
      requestId: 'test-request-id',
    });
  }),

  http.get('/api/automation-catalog', () => {
    return HttpResponse.json({
      data: {
        categories: [
          {
            name: 'Code Quality',
            templates: [
              {
                slug: 'pr-code-review',
                name: 'PR Code Review',
                description: 'Automatically reviews pull requests for code quality.',
                category: 'Code Quality',
                icon: 'search-code',
                triggerType: 'event',
                triggerConfig: { events: ['pull_request.opened'] },
                promptTemplate: 'Review the PR in {{repo.full_name}}.',
                provider: 'claude-code',
                model: null,
                variables: [],
              },
            ],
          },
          {
            name: 'Security',
            templates: [
              {
                slug: 'pr-security-scan',
                name: 'PR Security Scan',
                description: 'Scans pull requests for security vulnerabilities.',
                category: 'Security',
                icon: 'shield',
                triggerType: 'event',
                triggerConfig: { events: ['pull_request.opened'] },
                promptTemplate: 'Scan the PR in {{repo.full_name}}.',
                provider: 'claude-code',
                model: null,
                variables: [],
              },
            ],
          },
        ],
      },
      requestId: 'test-request-id',
    });
  }),

  http.post('/api/orgs/:orgId/automations/from-template', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      data: mockAutomationWithVariables({
        id: 200,
        name: `PR Code Review (repo-${body.repoId as number})`,
        variables: [],
      }),
      requestId: 'test-request-id',
    });
  }),
];
