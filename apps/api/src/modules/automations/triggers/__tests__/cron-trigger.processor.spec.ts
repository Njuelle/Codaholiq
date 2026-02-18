import { Job } from 'bullmq';
import { CronTriggerProcessor, CronTriggerJobData } from '../cron-trigger.processor';
import { AutomationRepository } from '../../automations.repository';
import { ExecutionRepository } from '../../../executions/executions.repository';
import { ExecutionLifecycleService } from '../../../executions/execution-lifecycle.service';
import { PromptTemplateService } from '../../templates/prompt-template.service';
import { VariablesService } from '../../../variables/variables.service';
import { GitHubEntityRepository } from '../../../github/github-entity.repository';

function createMockVariablesService() {
  return {
    findForResolution: vi.fn().mockResolvedValue([]),
  };
}

function createMockAutomationRepository() {
  return {
    findById: vi.fn().mockResolvedValue(undefined),
    findByIdInternal: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockExecutionRepository() {
  return {
    create: vi.fn().mockResolvedValue({ id: 1, status: 'pending' }),
    updateStatus: vi.fn().mockResolvedValue({ id: 1, status: 'failed' }),
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

function createMockFailureTracker() {
  return {
    trackFailure: vi.fn(),
    getFailureCount: vi.fn().mockReturnValue(0),
    reset: vi.fn(),
  };
}

function createMockGitHubEntityRepository() {
  return {
    findRepositoryById: vi.fn().mockResolvedValue({
      id: 100,
      owner: 'test-org',
      name: 'test-repo',
      fullName: 'test-org/test-repo',
    }),
  };
}

function makeJob(data: CronTriggerJobData): Job<CronTriggerJobData> {
  return { data } as Job<CronTriggerJobData>;
}

function makeAutomation(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    orgId: 10,
    repoId: 100,
    name: 'cron-automation',
    description: null,
    triggerType: 'cron' as const,
    triggerConfig: { schedule: '0 * * * *' },
    promptTemplate: 'Run check at {{timestamp}}',
    workflowFile: '.github/workflows/codaholiq.yml',
    enabled: true,
    createdBy: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    variables: [],
    ...overrides,
  };
}

describe('CronTriggerProcessor', () => {
  let processor: CronTriggerProcessor;
  let automationRepo: ReturnType<typeof createMockAutomationRepository>;
  let executionRepo: ReturnType<typeof createMockExecutionRepository>;
  let executionLifecycle: ReturnType<typeof createMockExecutionLifecycle>;
  let promptService: ReturnType<typeof createMockPromptTemplateService>;
  let githubEntityRepo: ReturnType<typeof createMockGitHubEntityRepository>;

  beforeEach(() => {
    automationRepo = createMockAutomationRepository();
    executionRepo = createMockExecutionRepository();
    executionLifecycle = createMockExecutionLifecycle();
    promptService = createMockPromptTemplateService();
    githubEntityRepo = createMockGitHubEntityRepository();

    processor = new CronTriggerProcessor(
      automationRepo as unknown as AutomationRepository,
      executionRepo as unknown as ExecutionRepository,
      executionLifecycle as unknown as ExecutionLifecycleService,
      promptService as unknown as PromptTemplateService,
      createMockFailureTracker() as never,
      createMockVariablesService() as unknown as VariablesService,
      githubEntityRepo as unknown as GitHubEntityRepository,
    );
  });

  it('should create and queue execution for enabled automation', async () => {
    const automation = makeAutomation();
    automationRepo.findByIdInternal.mockResolvedValue(automation);

    await processor.process(makeJob({ automationId: 1 }));

    expect(executionLifecycle.createAndQueue).toHaveBeenCalledWith({
      automationId: 1,
      automationName: 'cron-automation',
      repoId: 100,
      workflowFile: '.github/workflows/codaholiq.yml',
      triggerEvent: { type: 'cron', schedule: '0 * * * *' },
      resolvedPrompt: 'resolved prompt',
      model: undefined,
    });
  });

  it('should skip when automation not found', async () => {
    automationRepo.findByIdInternal.mockResolvedValue(undefined);

    await processor.process(makeJob({ automationId: 999 }));

    expect(executionLifecycle.createAndQueue).not.toHaveBeenCalled();
  });

  it('should skip when automation is disabled', async () => {
    automationRepo.findByIdInternal.mockResolvedValue(makeAutomation({ enabled: false }));

    await processor.process(makeJob({ automationId: 1 }));

    expect(executionLifecycle.createAndQueue).not.toHaveBeenCalled();
  });

  it('should create failed execution when template resolution fails', async () => {
    automationRepo.findByIdInternal.mockResolvedValue(makeAutomation());
    promptService.resolve.mockImplementation(() => {
      throw new Error('Missing required variable');
    });

    await processor.process(makeJob({ automationId: 1 }));

    expect(executionRepo.create).toHaveBeenCalledWith({
      automationId: 1,
      triggerEvent: { type: 'cron', schedule: '0 * * * *' },
      resolvedPrompt: '',
    });
    expect(executionRepo.updateStatus).toHaveBeenCalledWith({
      id: 1,
      status: 'failed',
      fields: { errorMessage: 'Missing required variable' },
    });
  });

  it('should pass repo and automation built-in variables to prompt resolution', async () => {
    automationRepo.findByIdInternal.mockResolvedValue(makeAutomation());

    await processor.process(makeJob({ automationId: 1 }));

    expect(promptService.resolve).toHaveBeenCalledWith({
      template: 'Run check at {{timestamp}}',
      variables: [],
      sharedVariables: [],
      builtIns: expect.objectContaining({
        'automation.name': 'cron-automation',
        'repo.owner': 'test-org',
        'repo.name': 'test-repo',
        'repo.full_name': 'test-org/test-repo',
      }),
    });
  });

  it('should look up repository by automation repoId', async () => {
    automationRepo.findByIdInternal.mockResolvedValue(makeAutomation());

    await processor.process(makeJob({ automationId: 1 }));

    expect(githubEntityRepo.findRepositoryById).toHaveBeenCalledWith({ id: 100 });
  });

  it('should use empty strings for repo built-ins when repo not found', async () => {
    automationRepo.findByIdInternal.mockResolvedValue(makeAutomation());
    githubEntityRepo.findRepositoryById.mockResolvedValue(undefined);

    await processor.process(makeJob({ automationId: 1 }));

    expect(promptService.resolve).toHaveBeenCalledWith({
      template: 'Run check at {{timestamp}}',
      variables: [],
      sharedVariables: [],
      builtIns: expect.objectContaining({
        'repo.owner': '',
        'repo.name': '',
        'repo.full_name': '',
      }),
    });
  });
});
