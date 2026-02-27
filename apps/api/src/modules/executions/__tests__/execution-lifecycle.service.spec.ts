import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ExecutionLifecycleService } from '../execution-lifecycle.service';

function createMockExecutionRepository() {
  return {
    create: vi.fn().mockResolvedValue({
      id: 1,
      automationId: 10,
      status: 'pending',
      triggerEvent: null,
      resolvedPrompt: 'test prompt',
      provider: 'claude-code',
      githubRunId: null,
      githubRunUrl: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date(),
    }),
    findById: vi.fn(),
    findByIdWithAutomationInfo: vi.fn(),
    updateStatus: vi.fn().mockResolvedValue({
      id: 1,
      status: 'cancelled',
    }),
    countActiveByOrgId: vi.fn().mockResolvedValue(0),
  };
}

function createMockGithubEntityRepository() {
  return {
    findRepositoryById: vi.fn().mockResolvedValue({
      id: 100,
      installationId: 50,
      orgId: 1,
      owner: 'acme',
      name: 'widgets',
      fullName: 'acme/widgets',
      defaultBranch: 'main',
    }),
    findInstallationById: vi.fn().mockResolvedValue({
      id: 50,
      installationId: 9001,
      orgId: 1,
    }),
  };
}

function createMockGithubApiService() {
  return {
    cancelWorkflowRun: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockQueue() {
  return {
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
  };
}

describe('ExecutionLifecycleService', () => {
  let service: ExecutionLifecycleService;
  let executionRepository: ReturnType<typeof createMockExecutionRepository>;
  let githubEntityRepository: ReturnType<typeof createMockGithubEntityRepository>;
  let githubApiService: ReturnType<typeof createMockGithubApiService>;
  let queue: ReturnType<typeof createMockQueue>;

  beforeEach(() => {
    executionRepository = createMockExecutionRepository();
    githubEntityRepository = createMockGithubEntityRepository();
    githubApiService = createMockGithubApiService();
    queue = createMockQueue();

    service = new ExecutionLifecycleService(
      executionRepository as never,
      githubEntityRepository as never,
      githubApiService as never,
      queue as never,
      { get: vi.fn().mockReturnValue(undefined) } as never,
    );
  });

  describe('createAndQueue', () => {
    it('should create execution and queue dispatch job', async () => {
      const result = await service.createAndQueue({
        automationId: 10,
        automationName: 'Test Automation',
        repoId: 100,
        workflowFile: '.github/workflows/codaholiq.yml',
        triggerEvent: { type: 'manual', triggered_by: 1 },
        resolvedPrompt: 'test prompt',
        provider: 'claude-code',
      });

      expect(result.id).toBe(1);
      expect(result.status).toBe('pending');

      expect(executionRepository.create).toHaveBeenCalledWith({
        automationId: 10,
        triggerEvent: { type: 'manual', triggered_by: 1 },
        resolvedPrompt: 'test prompt',
        provider: 'claude-code',
      });

      expect(queue.add).toHaveBeenCalledWith(
        'dispatch',
        {
          executionId: 1,
          automationId: 10,
          automationName: 'Test Automation',
          installationId: 9001,
          owner: 'acme',
          repo: 'widgets',
          workflowFile: '.github/workflows/codaholiq.yml',
          ref: 'main',
          provider: 'claude-code',
        },
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        }),
      );
    });

    it('should throw if repository not found', async () => {
      githubEntityRepository.findRepositoryById.mockResolvedValue(undefined);

      await expect(
        service.createAndQueue({
          automationId: 10,
          automationName: 'Test',
          repoId: 999,
          workflowFile: 'ci.yml',
          resolvedPrompt: 'prompt',
          provider: 'claude-code',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if installation not found', async () => {
      githubEntityRepository.findInstallationById.mockResolvedValue(undefined);

      await expect(
        service.createAndQueue({
          automationId: 10,
          automationName: 'Test',
          repoId: 100,
          workflowFile: 'ci.yml',
          resolvedPrompt: 'prompt',
          provider: 'claude-code',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('should no-op for terminal state execution', async () => {
      executionRepository.findById.mockResolvedValue({
        execution: { id: 1, status: 'completed' },
        automationName: 'test',
      });

      await service.cancel({ executionId: 1 });

      expect(executionRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should cancel pending execution', async () => {
      executionRepository.findById.mockResolvedValue({
        execution: { id: 1, status: 'pending', githubRunId: null },
        automationName: 'test',
      });

      await service.cancel({ executionId: 1 });

      expect(executionRepository.updateStatus).toHaveBeenCalledWith({
        id: 1,
        status: 'cancelled',
        fields: { completedAt: expect.any(Date) },
      });
    });

    it('should cancel dispatching execution', async () => {
      executionRepository.findById.mockResolvedValue({
        execution: { id: 1, status: 'dispatching', githubRunId: null },
        automationName: 'test',
      });

      await service.cancel({ executionId: 1 });

      expect(executionRepository.updateStatus).toHaveBeenCalledWith({
        id: 1,
        status: 'cancelled',
        fields: { completedAt: expect.any(Date) },
      });
    });

    it('should cancel running execution and call GitHub API', async () => {
      executionRepository.findById.mockResolvedValue({
        execution: { id: 1, status: 'running', githubRunId: 5000 },
        automationName: 'test',
      });
      executionRepository.findByIdWithAutomationInfo.mockResolvedValue({
        execution: { id: 1, status: 'running', githubRunId: 5000 },
        repoId: 100,
        workflowFile: 'ci.yml',
      });

      await service.cancel({ executionId: 1 });

      expect(githubApiService.cancelWorkflowRun).toHaveBeenCalledWith({
        installationId: 9001,
        owner: 'acme',
        repo: 'widgets',
        runId: 5000,
      });
      expect(executionRepository.updateStatus).toHaveBeenCalledWith({
        id: 1,
        status: 'cancelled',
        fields: { completedAt: expect.any(Date) },
      });
    });

    it('should still cancel execution if GitHub API cancel fails', async () => {
      executionRepository.findById.mockResolvedValue({
        execution: { id: 1, status: 'running', githubRunId: 5000 },
        automationName: 'test',
      });
      executionRepository.findByIdWithAutomationInfo.mockResolvedValue({
        execution: { id: 1, status: 'running', githubRunId: 5000 },
        repoId: 100,
        workflowFile: 'ci.yml',
      });
      githubApiService.cancelWorkflowRun.mockRejectedValue(new Error('GitHub API error'));

      await service.cancel({ executionId: 1 });

      expect(executionRepository.updateStatus).toHaveBeenCalledWith({
        id: 1,
        status: 'cancelled',
        fields: { completedAt: expect.any(Date) },
      });
    });

    it('should cancel running execution even when githubRunId is null', async () => {
      executionRepository.findById.mockResolvedValue({
        execution: { id: 1, status: 'running', githubRunId: null },
        automationName: 'test',
      });

      await service.cancel({ executionId: 1 });

      expect(githubApiService.cancelWorkflowRun).not.toHaveBeenCalled();
      expect(executionRepository.updateStatus).toHaveBeenCalledWith({
        id: 1,
        status: 'cancelled',
        fields: { completedAt: expect.any(Date) },
      });
    });

    it('should throw if execution not found', async () => {
      executionRepository.findById.mockResolvedValue(undefined);

      await expect(service.cancel({ executionId: 999 })).rejects.toThrow(NotFoundException);
    });
  });

  describe('retry', () => {
    it('should create new execution with same params', async () => {
      executionRepository.findByIdWithAutomationInfo.mockResolvedValue({
        execution: {
          id: 1,
          automationId: 10,
          status: 'failed',
          triggerEvent: { type: 'manual', triggered_by: 1 },
          resolvedPrompt: 'original prompt',
          provider: 'claude-code',
        },
        automationName: 'Fix TypeScript errors',
        repoId: 100,
        workflowFile: '.github/workflows/codaholiq.yml',
      });
      executionRepository.create.mockResolvedValue({
        id: 2,
        automationId: 10,
        status: 'pending',
        resolvedPrompt: 'original prompt',
        provider: 'claude-code',
        createdAt: new Date(),
      });

      const result = await service.retry({ executionId: 1 });

      expect(result.id).toBe(2);
      expect(executionRepository.create).toHaveBeenCalledWith({
        automationId: 10,
        triggerEvent: { type: 'manual', triggered_by: 1 },
        resolvedPrompt: 'original prompt',
        provider: 'claude-code',
      });
      expect(queue.add).toHaveBeenCalledWith(
        'dispatch',
        expect.objectContaining({ executionId: 2 }),
        expect.any(Object),
      );
    });

    it('should throw if execution not found', async () => {
      executionRepository.findByIdWithAutomationInfo.mockResolvedValue(undefined);

      await expect(service.retry({ executionId: 999 })).rejects.toThrow(NotFoundException);
    });

    it('should throw if execution is not in terminal state', async () => {
      executionRepository.findByIdWithAutomationInfo.mockResolvedValue({
        execution: {
          id: 1,
          automationId: 10,
          status: 'running',
          resolvedPrompt: 'prompt',
        },
        automationName: 'Test',
        repoId: 100,
        workflowFile: 'ci.yml',
      });

      await expect(service.retry({ executionId: 1 })).rejects.toThrow(BadRequestException);
    });
  });
});
