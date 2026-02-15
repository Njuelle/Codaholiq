import { EventMatcherService } from '../event-matcher.service';
import { AutomationRepository } from '../../automations.repository';
import { GitHubEntityRepository } from '../../../github/github-entity.repository';
import { ExecutionLifecycleService } from '../../../executions/execution-lifecycle.service';
import { PromptTemplateService } from '../../templates/prompt-template.service';
import { ConditionEvaluatorService } from '../condition-evaluator.service';
import { VariablesService } from '../../../variables/variables.service';

function createMockVariablesService() {
  return {
    findForResolution: vi.fn().mockResolvedValue([]),
  };
}

function createMockAutomationRepository() {
  return {
    findByRepoAndEvent: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(undefined),
    findByIdInternal: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockGitHubEntityRepository() {
  return {
    findRepositoryByFullNameGlobal: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockExecutionLifecycle() {
  return {
    createAndQueue: vi.fn().mockResolvedValue({ id: 1, status: 'pending' }),
  };
}

function createMockPromptTemplateService() {
  return {
    resolve: vi.fn().mockReturnValue('resolved prompt'),
  };
}

function createMockConditionEvaluator() {
  return {
    evaluateGroups: vi.fn().mockReturnValue(true),
  };
}

function makeAutomation(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    orgId: 10,
    repoId: 100,
    name: 'test-automation',
    description: null,
    triggerType: 'event' as const,
    triggerConfig: { events: ['pull_request.opened'] },
    promptTemplate: 'Review PR {{pr.title}}',
    workflowFile: '.github/workflows/codaholiq.yml',
    enabled: true,
    createdBy: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    variables: [],
    ...overrides,
  };
}

function makeRepo(overrides: Record<string, unknown> = {}) {
  return {
    id: 100,
    githubId: 12345,
    installationId: 1,
    orgId: 10,
    owner: 'octocat',
    name: 'hello-world',
    fullName: 'octocat/hello-world',
    defaultBranch: 'main',
    private: false,
    language: 'TypeScript',
    archived: false,
    webhookActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('EventMatcherService', () => {
  let service: EventMatcherService;
  let automationRepo: ReturnType<typeof createMockAutomationRepository>;
  let githubRepo: ReturnType<typeof createMockGitHubEntityRepository>;
  let executionLifecycle: ReturnType<typeof createMockExecutionLifecycle>;
  let promptService: ReturnType<typeof createMockPromptTemplateService>;
  let conditionEvaluator: ReturnType<typeof createMockConditionEvaluator>;
  let variablesService: ReturnType<typeof createMockVariablesService>;

  beforeEach(() => {
    automationRepo = createMockAutomationRepository();
    githubRepo = createMockGitHubEntityRepository();
    executionLifecycle = createMockExecutionLifecycle();
    promptService = createMockPromptTemplateService();
    conditionEvaluator = createMockConditionEvaluator();
    variablesService = createMockVariablesService();

    service = new EventMatcherService(
      automationRepo as unknown as AutomationRepository,
      githubRepo as unknown as GitHubEntityRepository,
      executionLifecycle as unknown as ExecutionLifecycleService,
      promptService as unknown as PromptTemplateService,
      conditionEvaluator as unknown as ConditionEvaluatorService,
      variablesService as unknown as VariablesService,
    );
  });

  describe('findMatchingAutomations', () => {
    it('should return matching automations for pull_request.opened', async () => {
      const automation = makeAutomation();
      githubRepo.findRepositoryByFullNameGlobal.mockResolvedValue(makeRepo());
      automationRepo.findByRepoAndEvent.mockResolvedValue([automation]);

      const result = await service.findMatchingAutomations({
        repoFullName: 'octocat/hello-world',
        eventType: 'pull_request',
        action: 'opened',
        payload: { action: 'opened' },
      });

      expect(result).toEqual([automation]);
      expect(automationRepo.findByRepoAndEvent).toHaveBeenCalledWith({
        repoId: 100,
        eventType: 'pull_request.opened',
      });
    });

    it('should return empty array when repo is not found', async () => {
      githubRepo.findRepositoryByFullNameGlobal.mockResolvedValue(undefined);

      const result = await service.findMatchingAutomations({
        repoFullName: 'unknown/repo',
        eventType: 'push',
        action: '',
        payload: {},
      });

      expect(result).toEqual([]);
    });

    it('should return empty array when no automations match', async () => {
      githubRepo.findRepositoryByFullNameGlobal.mockResolvedValue(makeRepo());
      automationRepo.findByRepoAndEvent.mockResolvedValue([]);

      const result = await service.findMatchingAutomations({
        repoFullName: 'octocat/hello-world',
        eventType: 'issues',
        action: 'opened',
        payload: { action: 'opened' },
      });

      expect(result).toEqual([]);
    });

    it('should handle push events (no action)', async () => {
      const automation = makeAutomation({
        triggerConfig: { events: ['push'] },
      });
      githubRepo.findRepositoryByFullNameGlobal.mockResolvedValue(makeRepo());
      automationRepo.findByRepoAndEvent.mockResolvedValue([automation]);

      const result = await service.findMatchingAutomations({
        repoFullName: 'octocat/hello-world',
        eventType: 'push',
        action: '',
        payload: {},
      });

      expect(result).toEqual([automation]);
      expect(automationRepo.findByRepoAndEvent).toHaveBeenCalledWith({
        repoId: 100,
        eventType: 'push',
      });
    });

    it('should match compound events with conclusion (workflow_run.completed.failure)', async () => {
      const automation = makeAutomation({
        triggerConfig: { events: ['workflow_run.completed.failure'] },
      });
      githubRepo.findRepositoryByFullNameGlobal.mockResolvedValue(makeRepo());
      // First call (for workflow_run.completed) returns empty
      // Second call (for workflow_run.completed.failure) returns match
      automationRepo.findByRepoAndEvent
        .mockResolvedValueOnce([]) // workflow_run.completed
        .mockResolvedValueOnce([automation]); // workflow_run.completed.failure

      const result = await service.findMatchingAutomations({
        repoFullName: 'octocat/hello-world',
        eventType: 'workflow_run',
        action: 'completed',
        payload: {
          action: 'completed',
          workflow_run: { conclusion: 'failure' },
        },
      });

      expect(result).toEqual([automation]);
    });

    it('should return multiple matching automations', async () => {
      const auto1 = makeAutomation({ id: 1 });
      const auto2 = makeAutomation({ id: 2, name: 'second-automation' });
      githubRepo.findRepositoryByFullNameGlobal.mockResolvedValue(makeRepo());
      automationRepo.findByRepoAndEvent.mockResolvedValue([auto1, auto2]);

      const result = await service.findMatchingAutomations({
        repoFullName: 'octocat/hello-world',
        eventType: 'pull_request',
        action: 'opened',
        payload: { action: 'opened' },
      });

      expect(result).toHaveLength(2);
    });
  });

  describe('findAndCreateExecutions', () => {
    it('should create executions for matching automations', async () => {
      const automation = makeAutomation();
      githubRepo.findRepositoryByFullNameGlobal.mockResolvedValue(makeRepo());
      automationRepo.findByRepoAndEvent.mockResolvedValue([automation]);
      automationRepo.findByIdInternal.mockResolvedValue(automation);

      await service.findAndCreateExecutions({
        repoFullName: 'octocat/hello-world',
        eventType: 'pull_request',
        action: 'opened',
        payload: { action: 'opened', pull_request: { title: 'Fix bug' } },
      });

      expect(executionLifecycle.createAndQueue).toHaveBeenCalledWith({
        automationId: 1,
        automationName: 'test-automation',
        repoId: 100,
        workflowFile: '.github/workflows/codaholiq.yml',
        triggerEvent: {
          type: 'pull_request',
          action: 'opened',
          payload: expect.objectContaining({ action: 'opened' }),
        },
        resolvedPrompt: 'resolved prompt',
      });
    });

    it('should not create executions when no automations match', async () => {
      githubRepo.findRepositoryByFullNameGlobal.mockResolvedValue(makeRepo());
      automationRepo.findByRepoAndEvent.mockResolvedValue([]);

      await service.findAndCreateExecutions({
        repoFullName: 'octocat/hello-world',
        eventType: 'push',
        action: '',
        payload: {},
      });

      expect(executionLifecycle.createAndQueue).not.toHaveBeenCalled();
    });

    it('should continue creating executions even if one fails', async () => {
      const auto1 = makeAutomation({ id: 1 });
      const auto2 = makeAutomation({ id: 2, name: 'second' });
      githubRepo.findRepositoryByFullNameGlobal.mockResolvedValue(makeRepo());
      automationRepo.findByRepoAndEvent.mockResolvedValue([auto1, auto2]);
      automationRepo.findByIdInternal.mockResolvedValueOnce(auto1).mockResolvedValueOnce(auto2);
      promptService.resolve
        .mockImplementationOnce(() => {
          throw new Error('Template error');
        })
        .mockReturnValueOnce('resolved prompt');

      await service.findAndCreateExecutions({
        repoFullName: 'octocat/hello-world',
        eventType: 'pull_request',
        action: 'opened',
        payload: { action: 'opened' },
      });

      // Second execution should still be created despite first failing
      expect(executionLifecycle.createAndQueue).toHaveBeenCalledTimes(1);
    });

    it('should pass built-in variables to prompt resolution', async () => {
      const automation = makeAutomation();
      githubRepo.findRepositoryByFullNameGlobal.mockResolvedValue(makeRepo());
      automationRepo.findByRepoAndEvent.mockResolvedValue([automation]);
      automationRepo.findByIdInternal.mockResolvedValue(automation);

      await service.findAndCreateExecutions({
        repoFullName: 'octocat/hello-world',
        eventType: 'pull_request',
        action: 'opened',
        payload: { action: 'opened' },
      });

      expect(promptService.resolve).toHaveBeenCalledWith({
        template: automation.promptTemplate,
        variables: [],
        sharedVariables: [],
        eventPayload: expect.objectContaining({ action: 'opened' }),
        builtIns: expect.objectContaining({
          'event.type': 'pull_request',
          'event.action': 'opened',
          'automation.name': 'test-automation',
        }),
      });
    });

    it('should extract event built-ins from issue payload', async () => {
      const automation = makeAutomation({
        triggerConfig: { events: ['issues.labeled'] },
      });
      githubRepo.findRepositoryByFullNameGlobal.mockResolvedValue(makeRepo());
      automationRepo.findByRepoAndEvent.mockResolvedValue([automation]);
      automationRepo.findByIdInternal.mockResolvedValue(automation);

      await service.findAndCreateExecutions({
        repoFullName: 'octocat/hello-world',
        eventType: 'issues',
        action: 'labeled',
        payload: {
          action: 'labeled',
          repository: { full_name: 'octocat/hello-world' },
          issue: { number: 42, title: 'Add dark mode', body: 'We need dark mode.' },
          label: { name: 'implement' },
        },
      });

      expect(promptService.resolve).toHaveBeenCalledWith(
        expect.objectContaining({
          builtIns: expect.objectContaining({
            'event.title': 'Add dark mode',
            'event.body': 'We need dark mode.',
            'event.number': '42',
            'event.label': 'implement',
            'event.repo': 'octocat/hello-world',
          }),
        }),
      );
    });

    it('should extract event built-ins from pull request payload', async () => {
      const automation = makeAutomation();
      githubRepo.findRepositoryByFullNameGlobal.mockResolvedValue(makeRepo());
      automationRepo.findByRepoAndEvent.mockResolvedValue([automation]);
      automationRepo.findByIdInternal.mockResolvedValue(automation);

      await service.findAndCreateExecutions({
        repoFullName: 'octocat/hello-world',
        eventType: 'pull_request',
        action: 'opened',
        payload: {
          action: 'opened',
          repository: { full_name: 'octocat/hello-world' },
          pull_request: { number: 10, title: 'Fix bug', body: 'Fixes #5' },
        },
      });

      expect(promptService.resolve).toHaveBeenCalledWith(
        expect.objectContaining({
          builtIns: expect.objectContaining({
            'event.title': 'Fix bug',
            'event.body': 'Fixes #5',
            'event.number': '10',
            'event.repo': 'octocat/hello-world',
          }),
        }),
      );
    });

    it('should not create execution when repo is unknown', async () => {
      githubRepo.findRepositoryByFullNameGlobal.mockResolvedValue(undefined);

      await service.findAndCreateExecutions({
        repoFullName: 'unknown/repo',
        eventType: 'push',
        action: '',
        payload: {},
      });

      expect(executionLifecycle.createAndQueue).not.toHaveBeenCalled();
    });

    it('should not create execution when conditions are not satisfied', async () => {
      const automation = makeAutomation({
        triggerConfig: {
          events: ['issues.labeled'],
          conditionGroups: [
            { conditions: [{ path: 'label.name', operator: 'equals', value: 'bug' }] },
          ],
        },
      });
      githubRepo.findRepositoryByFullNameGlobal.mockResolvedValue(makeRepo());
      automationRepo.findByRepoAndEvent.mockResolvedValue([automation]);
      conditionEvaluator.evaluateGroups.mockReturnValue(false);

      await service.findAndCreateExecutions({
        repoFullName: 'octocat/hello-world',
        eventType: 'issues',
        action: 'labeled',
        payload: { action: 'labeled', label: { name: 'enhancement' } },
      });

      expect(executionLifecycle.createAndQueue).not.toHaveBeenCalled();
    });

    it('should create execution when conditions are satisfied', async () => {
      const automation = makeAutomation({
        triggerConfig: {
          events: ['issues.labeled'],
          conditionGroups: [
            { conditions: [{ path: 'label.name', operator: 'equals', value: 'bug' }] },
          ],
        },
      });
      githubRepo.findRepositoryByFullNameGlobal.mockResolvedValue(makeRepo());
      automationRepo.findByRepoAndEvent.mockResolvedValue([automation]);
      automationRepo.findByIdInternal.mockResolvedValue(automation);
      conditionEvaluator.evaluateGroups.mockReturnValue(true);

      await service.findAndCreateExecutions({
        repoFullName: 'octocat/hello-world',
        eventType: 'issues',
        action: 'labeled',
        payload: { action: 'labeled', label: { name: 'bug' } },
      });

      expect(executionLifecycle.createAndQueue).toHaveBeenCalledTimes(1);
    });

    it('should create execution when automation has no conditions (backward compat)', async () => {
      const automation = makeAutomation({
        triggerConfig: { events: ['push'] },
      });
      githubRepo.findRepositoryByFullNameGlobal.mockResolvedValue(makeRepo());
      automationRepo.findByRepoAndEvent.mockResolvedValue([automation]);
      automationRepo.findByIdInternal.mockResolvedValue(automation);
      conditionEvaluator.evaluateGroups.mockReturnValue(true);

      await service.findAndCreateExecutions({
        repoFullName: 'octocat/hello-world',
        eventType: 'push',
        action: '',
        payload: { ref: 'refs/heads/main' },
      });

      expect(executionLifecycle.createAndQueue).toHaveBeenCalledTimes(1);
      expect(conditionEvaluator.evaluateGroups).toHaveBeenCalledWith({
        conditionGroups: undefined,
        payload: { ref: 'refs/heads/main' },
      });
    });

    it('should filter by conditions on compound event matches (OR groups)', async () => {
      const auto1 = makeAutomation({
        id: 1,
        triggerConfig: {
          events: ['workflow_run.completed.failure'],
          conditionGroups: [
            { conditions: [{ path: 'workflow_run.name', operator: 'equals', value: 'CI' }] },
          ],
        },
      });
      const auto2 = makeAutomation({
        id: 2,
        name: 'other',
        triggerConfig: {
          events: ['workflow_run.completed.failure'],
          conditionGroups: [
            { conditions: [{ path: 'workflow_run.name', operator: 'equals', value: 'Deploy' }] },
          ],
        },
      });
      githubRepo.findRepositoryByFullNameGlobal.mockResolvedValue(makeRepo());
      automationRepo.findByRepoAndEvent
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([auto1, auto2]);
      automationRepo.findByIdInternal.mockResolvedValueOnce(auto1);
      // Only auto1 passes conditions
      conditionEvaluator.evaluateGroups.mockReturnValueOnce(true).mockReturnValueOnce(false);

      await service.findAndCreateExecutions({
        repoFullName: 'octocat/hello-world',
        eventType: 'workflow_run',
        action: 'completed',
        payload: {
          action: 'completed',
          workflow_run: { conclusion: 'failure', name: 'CI' },
        },
      });

      expect(executionLifecycle.createAndQueue).toHaveBeenCalledTimes(1);
    });

    it('should sanitize PII from payload before storing', async () => {
      const automation = makeAutomation();
      githubRepo.findRepositoryByFullNameGlobal.mockResolvedValue(makeRepo());
      automationRepo.findByRepoAndEvent.mockResolvedValue([automation]);
      automationRepo.findByIdInternal.mockResolvedValue(automation);

      await service.findAndCreateExecutions({
        repoFullName: 'octocat/hello-world',
        eventType: 'pull_request',
        action: 'opened',
        payload: {
          action: 'opened',
          sender: {
            login: 'octocat',
            email: 'secret@example.com',
            avatar_url: 'https://avatars.example.com/1',
            gravatar_id: 'abc',
          },
          pull_request: {
            number: 1,
            user: {
              login: 'contributor',
              email: 'private@example.com',
            },
          },
        },
      });

      const triggerEvent = executionLifecycle.createAndQueue.mock.calls[0][0].triggerEvent;

      // Sensitive fields should be stripped
      expect(triggerEvent.payload.sender).toEqual({
        login: 'octocat',
      });
      expect(triggerEvent.payload.pull_request).toEqual({
        number: 1,
        user: { login: 'contributor' },
      });
    });
  });
});
