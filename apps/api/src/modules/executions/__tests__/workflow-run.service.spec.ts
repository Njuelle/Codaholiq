import { WorkflowRunService } from '../workflow-run.service';

function createMockExecutionRepository() {
  return {
    findByGithubRunId: vi.fn().mockResolvedValue(undefined),
    updateStatus: vi.fn().mockResolvedValue({ id: 1 }),
  };
}

function createMockQueue() {
  return {
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
  };
}

function makePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    action: 'completed',
    workflow_run: {
      id: 5000,
      conclusion: 'success',
      html_url: 'https://github.com/acme/widgets/actions/runs/5000',
    },
    installation: { id: 9001 },
    repository: {
      owner: { login: 'acme' },
      name: 'widgets',
    },
    ...overrides,
  };
}

describe('WorkflowRunService', () => {
  let service: WorkflowRunService;
  let executionRepo: ReturnType<typeof createMockExecutionRepository>;
  let queue: ReturnType<typeof createMockQueue>;

  beforeEach(() => {
    executionRepo = createMockExecutionRepository();
    queue = createMockQueue();

    service = new WorkflowRunService(executionRepo as never, queue as never);
  });

  it('should update execution to completed on success conclusion', async () => {
    executionRepo.findByGithubRunId.mockResolvedValue({
      id: 1,
      status: 'running',
      githubRunId: 5000,
    });

    await service.handleWorkflowRunCompleted({
      payload: makePayload(),
    });

    expect(executionRepo.updateStatus).toHaveBeenCalledWith({
      id: 1,
      status: 'completed',
      fields: { completedAt: expect.any(Date) },
    });
  });

  it('should update execution to failed on failure conclusion', async () => {
    executionRepo.findByGithubRunId.mockResolvedValue({
      id: 1,
      status: 'running',
      githubRunId: 5000,
    });

    await service.handleWorkflowRunCompleted({
      payload: makePayload({
        workflow_run: { id: 5000, conclusion: 'failure', html_url: 'url' },
      }),
    });

    expect(executionRepo.updateStatus).toHaveBeenCalledWith({
      id: 1,
      status: 'failed',
      fields: { completedAt: expect.any(Date) },
    });
  });

  it('should queue log collection after updating execution', async () => {
    executionRepo.findByGithubRunId.mockResolvedValue({
      id: 1,
      status: 'running',
      githubRunId: 5000,
      provider: 'claude-code',
    });

    await service.handleWorkflowRunCompleted({
      payload: makePayload(),
    });

    expect(queue.add).toHaveBeenCalledWith(
      'collect-logs',
      {
        executionId: 1,
        githubRunId: 5000,
        installationId: 9001,
        owner: 'acme',
        repo: 'widgets',
        provider: 'claude-code',
      },
      expect.any(Object),
    );
  });

  it('should ignore unknown run IDs', async () => {
    executionRepo.findByGithubRunId.mockResolvedValue(undefined);

    await service.handleWorkflowRunCompleted({
      payload: makePayload(),
    });

    expect(executionRepo.updateStatus).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('should skip if execution is already in terminal state', async () => {
    executionRepo.findByGithubRunId.mockResolvedValue({
      id: 1,
      status: 'completed',
      githubRunId: 5000,
    });

    await service.handleWorkflowRunCompleted({
      payload: makePayload(),
    });

    expect(executionRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('should handle missing workflow_run in payload', async () => {
    await service.handleWorkflowRunCompleted({
      payload: { action: 'completed' },
    });

    expect(executionRepo.findByGithubRunId).not.toHaveBeenCalled();
  });
});
