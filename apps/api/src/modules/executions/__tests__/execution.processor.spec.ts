import { Job } from 'bullmq';
import AdmZip from 'adm-zip';
import { ExecutionProcessor } from '../execution.processor';
import type {
  DispatchJobData,
  PollStatusJobData,
  CollectLogsJobData,
} from '../executions.constants';

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

function createMockExecutionRepository() {
  return {
    findById: vi.fn().mockResolvedValue({
      execution: { id: 1, status: 'pending', resolvedPrompt: 'test prompt' },
      automationName: 'Test Automation',
      orgId: 1,
    }),
    updateStatus: vi.fn().mockResolvedValue({ id: 1 }),
    appendLog: vi.fn().mockResolvedValue({ id: 1 }),
    appendLogs: vi
      .fn()
      .mockImplementation(({ logs }: { logs: unknown[] }) =>
        Promise.resolve(logs.map((_, i) => ({ id: i + 1 }))),
      ),
    deleteLogsOlderThan: vi.fn().mockResolvedValue(10),
    deleteExecutionsOlderThan: vi.fn().mockResolvedValue(5),
  };
}

function createMockGitHubApiService() {
  return {
    dispatchWorkflow: vi.fn().mockResolvedValue(undefined),
    listWorkflowRuns: vi.fn().mockResolvedValue([]),
    getWorkflowRun: vi.fn(),
    getWorkflowRunLogs: vi.fn(),
  };
}

function createMockQueue() {
  return {
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
  };
}

function makeDispatchJob(overrides: Partial<DispatchJobData> = {}): Job<DispatchJobData> {
  const data: DispatchJobData = {
    executionId: 1,
    automationId: 10,
    automationName: 'Test Automation',
    installationId: 9001,
    owner: 'acme',
    repo: 'widgets',
    workflowFile: '.github/workflows/codaholiq.yml',
    ref: 'main',
    provider: 'claude-code',
    ...overrides,
  };
  return { name: 'dispatch', data } as Job<DispatchJobData>;
}

function makePollJob(overrides: Partial<PollStatusJobData> = {}): Job<PollStatusJobData> {
  const data: PollStatusJobData = {
    executionId: 1,
    githubRunId: 5000,
    installationId: 9001,
    owner: 'acme',
    repo: 'widgets',
    dispatchedAt: new Date().toISOString(),
    ...overrides,
  };
  return { name: 'poll-status', data } as Job<PollStatusJobData>;
}

function makeCollectLogsJob(overrides: Partial<CollectLogsJobData> = {}): Job<CollectLogsJobData> {
  const data: CollectLogsJobData = {
    executionId: 1,
    githubRunId: 5000,
    installationId: 9001,
    owner: 'acme',
    repo: 'widgets',
    ...overrides,
  };
  return { name: 'collect-logs', data } as Job<CollectLogsJobData>;
}

function createMockRedisLogPublisher() {
  return {
    publishLog: vi.fn().mockResolvedValue(undefined),
    publishStatus: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockReturnValue(vi.fn()),
  };
}

function createMockNotificationRepository() {
  return {
    create: vi.fn().mockResolvedValue({ id: 1 }),
    findByOrgId: vi.fn().mockResolvedValue([]),
    deleteById: vi.fn().mockResolvedValue(true),
    countByOrgId: vi.fn().mockResolvedValue(0),
  };
}

function createMockFailureTracker() {
  return {
    trackFailure: vi.fn(),
    getFailureCount: vi.fn().mockReturnValue(0),
    reset: vi.fn(),
  };
}

describe('ExecutionProcessor', () => {
  let processor: ExecutionProcessor;
  let executionRepo: ReturnType<typeof createMockExecutionRepository>;
  let githubApi: ReturnType<typeof createMockGitHubApiService>;
  let queue: ReturnType<typeof createMockQueue>;
  let notificationRepo: ReturnType<typeof createMockNotificationRepository>;

  beforeEach(() => {
    executionRepo = createMockExecutionRepository();
    githubApi = createMockGitHubApiService();
    queue = createMockQueue();
    notificationRepo = createMockNotificationRepository();

    processor = new ExecutionProcessor(
      executionRepo as never,
      githubApi as never,
      queue as never,
      notificationRepo as never,
      createMockRedisLogPublisher() as never,
      createMockFailureTracker() as never,
      {
        mapDispatchInputs: vi
          .fn()
          .mockImplementation(
            ({
              prompt,
              providerId,
              model,
            }: {
              prompt: string;
              providerId: string;
              model?: string;
            }) => {
              const inputs: Record<string, string> = { provider: providerId, prompt };
              if (model) inputs['model'] = model;
              return inputs;
            },
          ),
        getByIdOrThrow: vi.fn(),
      } as never,
    );
  });

  describe('dispatch', () => {
    it('should dispatch workflow and detect run ID', async () => {
      githubApi.listWorkflowRuns.mockResolvedValue([
        {
          id: 5000,
          status: 'queued',
          conclusion: null,
          html_url: 'https://github.com/acme/widgets/actions/runs/5000',
        },
      ]);

      // Speed up the sleep for tests
      vi.spyOn(processor as unknown as { sleep: () => Promise<void> }, 'sleep').mockResolvedValue(
        undefined,
      );

      await processor.process(makeDispatchJob());

      expect(executionRepo.updateStatus).toHaveBeenCalledWith({
        id: 1,
        status: 'dispatching',
        fields: { startedAt: expect.any(Date) },
      });

      expect(githubApi.dispatchWorkflow).toHaveBeenCalledWith({
        installationId: 9001,
        owner: 'acme',
        repo: 'widgets',
        workflowFile: '.github/workflows/codaholiq.yml',
        ref: 'main',
        inputs: {
          provider: 'claude-code',
          prompt: 'test prompt',
        },
      });

      expect(executionRepo.updateStatus).toHaveBeenCalledWith({
        id: 1,
        status: 'running',
        fields: {
          githubRunId: 5000,
          githubRunUrl: 'https://github.com/acme/widgets/actions/runs/5000',
        },
      });

      expect(queue.add).toHaveBeenCalledWith(
        'poll-status',
        expect.objectContaining({ executionId: 1, githubRunId: 5000 }),
        expect.objectContaining({ delay: 30000 }),
      );
    });

    it('should fail execution on dispatch error', async () => {
      githubApi.dispatchWorkflow.mockRejectedValue(new Error('GitHub API error'));
      executionRepo.findById.mockResolvedValue({
        execution: { id: 1, status: 'failed', resolvedPrompt: 'test prompt' },
        automationName: 'Test Automation',
        orgId: 1,
      });

      vi.spyOn(processor as unknown as { sleep: () => Promise<void> }, 'sleep').mockResolvedValue(
        undefined,
      );

      await expect(processor.process(makeDispatchJob())).rejects.toThrow('GitHub API error');

      expect(executionRepo.updateStatus).toHaveBeenCalledWith({
        id: 1,
        status: 'failed',
        fields: {
          errorMessage: 'GitHub API error',
          completedAt: expect.any(Date),
        },
      });
    });

    it('should still mark as running when run ID detection fails', async () => {
      githubApi.listWorkflowRuns.mockResolvedValue([]); // No runs found
      vi.spyOn(processor as unknown as { sleep: () => Promise<void> }, 'sleep').mockResolvedValue(
        undefined,
      );

      await processor.process(makeDispatchJob());

      expect(executionRepo.updateStatus).toHaveBeenCalledWith({
        id: 1,
        status: 'running',
      });
    });
  });

  describe('poll-status', () => {
    it('should update execution to completed when workflow succeeds', async () => {
      executionRepo.findById.mockResolvedValue({
        execution: { id: 1, status: 'running' },
        automationName: 'test',
      });
      githubApi.getWorkflowRun.mockResolvedValue({
        id: 5000,
        status: 'completed',
        conclusion: 'success',
        html_url: 'https://github.com/acme/widgets/actions/runs/5000',
      });

      await processor.process(makePollJob());

      expect(executionRepo.updateStatus).toHaveBeenCalledWith({
        id: 1,
        status: 'completed',
        fields: { completedAt: expect.any(Date) },
      });

      expect(queue.add).toHaveBeenCalledWith(
        'collect-logs',
        expect.objectContaining({ executionId: 1 }),
        expect.any(Object),
      );
    });

    it('should map failure conclusion to failed status', async () => {
      executionRepo.findById.mockResolvedValue({
        execution: { id: 1, status: 'running' },
        automationName: 'test',
      });
      githubApi.getWorkflowRun.mockResolvedValue({
        id: 5000,
        status: 'completed',
        conclusion: 'failure',
        html_url: 'url',
      });

      await processor.process(makePollJob());

      expect(executionRepo.updateStatus).toHaveBeenCalledWith({
        id: 1,
        status: 'failed',
        fields: { completedAt: expect.any(Date) },
      });
    });

    it('should map cancelled conclusion to cancelled status', async () => {
      executionRepo.findById.mockResolvedValue({
        execution: { id: 1, status: 'running' },
        automationName: 'test',
      });
      githubApi.getWorkflowRun.mockResolvedValue({
        id: 5000,
        status: 'completed',
        conclusion: 'cancelled',
        html_url: 'url',
      });

      await processor.process(makePollJob());

      expect(executionRepo.updateStatus).toHaveBeenCalledWith({
        id: 1,
        status: 'cancelled',
        fields: { completedAt: expect.any(Date) },
      });
    });

    it('should re-queue poll when workflow is still in progress', async () => {
      executionRepo.findById.mockResolvedValue({
        execution: { id: 1, status: 'running' },
        automationName: 'test',
      });
      githubApi.getWorkflowRun.mockResolvedValue({
        id: 5000,
        status: 'in_progress',
        conclusion: null,
        html_url: 'url',
      });

      await processor.process(makePollJob());

      expect(executionRepo.updateStatus).not.toHaveBeenCalled();
      expect(queue.add).toHaveBeenCalledWith(
        'poll-status',
        expect.objectContaining({ executionId: 1 }),
        expect.objectContaining({ delay: 30000 }),
      );
    });

    it('should skip poll when execution is in terminal state', async () => {
      executionRepo.findById.mockResolvedValue({
        execution: { id: 1, status: 'completed' },
        automationName: 'test',
      });

      await processor.process(makePollJob());

      expect(githubApi.getWorkflowRun).not.toHaveBeenCalled();
    });

    it('should mark as timed_out after 2 hours', async () => {
      executionRepo.findById.mockResolvedValue({
        execution: { id: 1, status: 'running' },
        automationName: 'test',
      });

      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000 - 1000).toISOString();

      await processor.process(makePollJob({ dispatchedAt: twoHoursAgo }));

      expect(executionRepo.updateStatus).toHaveBeenCalledWith({
        id: 1,
        status: 'timed_out',
        fields: {
          errorMessage: 'Workflow run exceeded 2-hour timeout',
          completedAt: expect.any(Date),
        },
      });
      expect(githubApi.getWorkflowRun).not.toHaveBeenCalled();
    });
  });

  describe('collect-logs', () => {
    it('should parse ZIP logs and batch-insert entries', async () => {
      const zip = new AdmZip();
      zip.addFile('step1/log.txt', Buffer.from('Step 1 output\nStep 2 output'));
      const zipBuffer = zip.toBuffer();

      githubApi.getWorkflowRunLogs.mockResolvedValue(toArrayBuffer(zipBuffer));

      await processor.process(makeCollectLogsJob());

      expect(executionRepo.appendLogs).toHaveBeenCalledWith({
        logs: [
          {
            executionId: 1,
            level: 'info',
            message: 'Step 1 output',
            metadata: { file: 'step1/log.txt' },
          },
          {
            executionId: 1,
            level: 'info',
            message: 'Step 2 output',
            metadata: { file: 'step1/log.txt' },
          },
        ],
      });
    });

    it('should log error when log collection fails', async () => {
      githubApi.getWorkflowRunLogs.mockRejectedValue(new Error('Logs not available'));

      await processor.process(makeCollectLogsJob());

      expect(executionRepo.appendLog).toHaveBeenCalledWith({
        executionId: 1,
        level: 'error',
        message: expect.stringContaining('Failed to collect workflow logs'),
      });
    });
  });

  describe('parseWorkflowLogs', () => {
    it('should strip ANSI escape codes', () => {
      const zip = new AdmZip();
      zip.addFile('job/step.txt', Buffer.from('\x1B[32mGreen text\x1B[0m'));
      const zipBuffer = zip.toBuffer();

      const entries = processor.parseWorkflowLogs({
        logsBuffer: toArrayBuffer(zipBuffer),
      });

      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('Green text');
    });

    it('should truncate long messages', () => {
      const zip = new AdmZip();
      const longLine = 'x'.repeat(5000);
      zip.addFile('job/step.txt', Buffer.from(longLine));
      const zipBuffer = zip.toBuffer();

      const entries = processor.parseWorkflowLogs({
        logsBuffer: toArrayBuffer(zipBuffer),
      });

      expect(entries).toHaveLength(1);
      expect(entries[0].message.length).toBe(4003); // 4000 + '...'
      expect(entries[0].message).toMatch(/\.\.\.$/);
    });

    it('should cap at 1000 entries', () => {
      const zip = new AdmZip();
      const lines = Array.from({ length: 1200 }, (_, i) => `Line ${i}`).join('\n');
      zip.addFile('job/step.txt', Buffer.from(lines));
      const zipBuffer = zip.toBuffer();

      const entries = processor.parseWorkflowLogs({
        logsBuffer: toArrayBuffer(zipBuffer),
      });

      expect(entries).toHaveLength(1000);
    });

    it('should return error entry for invalid ZIP', () => {
      const entries = processor.parseWorkflowLogs({
        logsBuffer: new ArrayBuffer(10),
      });

      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('Failed to parse workflow logs ZIP archive');
    });
  });

  describe('failure notifications', () => {
    it('should create notification when dispatch fails', async () => {
      githubApi.dispatchWorkflow.mockRejectedValue(new Error('dispatch error'));
      executionRepo.findById.mockResolvedValue({
        execution: { id: 1, status: 'failed' },
        automationName: 'Deploy',
        orgId: 42,
      });
      vi.spyOn(processor as unknown as { sleep: () => Promise<void> }, 'sleep').mockResolvedValue(
        undefined,
      );

      await expect(processor.process(makeDispatchJob())).rejects.toThrow('dispatch error');

      expect(notificationRepo.create).toHaveBeenCalledWith({
        orgId: 42,
        executionId: 1,
        automationName: 'Deploy',
        message: 'Execution #1 of "Deploy" failed',
      });
    });

    it('should create notification when workflow conclusion is failure', async () => {
      executionRepo.findById.mockResolvedValue({
        execution: { id: 1, status: 'running' },
        automationName: 'Lint Check',
        orgId: 7,
      });
      githubApi.getWorkflowRun.mockResolvedValue({
        id: 5000,
        status: 'completed',
        conclusion: 'failure',
        html_url: 'url',
      });

      await processor.process(makePollJob());

      expect(notificationRepo.create).toHaveBeenCalledWith({
        orgId: 7,
        executionId: 1,
        automationName: 'Lint Check',
        message: 'Execution #1 of "Lint Check" failed',
      });
    });

    it('should not create notification when workflow succeeds', async () => {
      executionRepo.findById.mockResolvedValue({
        execution: { id: 1, status: 'running' },
        automationName: 'test',
        orgId: 1,
      });
      githubApi.getWorkflowRun.mockResolvedValue({
        id: 5000,
        status: 'completed',
        conclusion: 'success',
        html_url: 'url',
      });

      await processor.process(makePollJob());

      expect(notificationRepo.create).not.toHaveBeenCalled();
    });

    it('should not break execution flow when notification creation fails', async () => {
      executionRepo.findById.mockResolvedValue({
        execution: { id: 1, status: 'running' },
        automationName: 'test',
        orgId: 1,
      });
      githubApi.getWorkflowRun.mockResolvedValue({
        id: 5000,
        status: 'completed',
        conclusion: 'failure',
        html_url: 'url',
      });
      notificationRepo.create.mockRejectedValue(new Error('DB error'));

      // Should not throw
      await processor.process(makePollJob());

      expect(executionRepo.updateStatus).toHaveBeenCalledWith({
        id: 1,
        status: 'failed',
        fields: { completedAt: expect.any(Date) },
      });
    });
  });
});
