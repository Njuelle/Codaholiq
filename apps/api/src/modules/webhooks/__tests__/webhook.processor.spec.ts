import { WebhookProcessor, type WebhookJobData } from '../webhook.processor';
import type { InstallationService } from '../../github/installation.service';
import type { EventMatcherService } from '../../automations/triggers/event-matcher.service';
import type { WorkflowRunService } from '../../executions/workflow-run.service';
import type { Job } from 'bullmq';

function createMockInstallationService(): Record<string, ReturnType<typeof vi.fn>> {
  return {
    handleInstallationCreated: vi.fn().mockResolvedValue(undefined),
    handleInstallationDeleted: vi.fn().mockResolvedValue(undefined),
    handleInstallationSuspended: vi.fn().mockResolvedValue(undefined),
    handleInstallationUnsuspended: vi.fn().mockResolvedValue(undefined),
    handleRepositoriesAdded: vi.fn().mockResolvedValue(undefined),
    handleRepositoriesRemoved: vi.fn().mockResolvedValue(undefined),
  };
}

function makeJob(overrides: Partial<WebhookJobData> & { name?: string }): Job<WebhookJobData> {
  const data: WebhookJobData = {
    event: overrides.event ?? 'installation',
    action: overrides.action ?? 'created',
    deliveryId: overrides.deliveryId ?? 'test-delivery-id',
    payload: overrides.payload ?? {},
  };
  return {
    name: overrides.name ?? `${data.event}.${data.action}`,
    data,
  } as unknown as Job<WebhookJobData>;
}

function createMockEventMatcherService(): Record<string, ReturnType<typeof vi.fn>> {
  return {
    findAndCreateExecutions: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockWorkflowRunService(): Record<string, ReturnType<typeof vi.fn>> {
  return {
    handleWorkflowRunCompleted: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockFailureTracker() {
  return {
    trackFailure: vi.fn(),
    getFailureCount: vi.fn().mockReturnValue(0),
    reset: vi.fn(),
  };
}

describe('WebhookProcessor', () => {
  let processor: WebhookProcessor;
  let mockService: ReturnType<typeof createMockInstallationService>;
  let mockEventMatcher: ReturnType<typeof createMockEventMatcherService>;
  let mockWorkflowRun: ReturnType<typeof createMockWorkflowRunService>;

  beforeEach(() => {
    mockService = createMockInstallationService();
    mockEventMatcher = createMockEventMatcherService();
    mockWorkflowRun = createMockWorkflowRunService();
    processor = new WebhookProcessor(
      mockService as unknown as InstallationService,
      mockEventMatcher as unknown as EventMatcherService,
      mockWorkflowRun as unknown as WorkflowRunService,
      createMockFailureTracker() as never,
    );
  });

  describe('installation events', () => {
    it('should route installation.created to handleInstallationCreated', async () => {
      const payload = { installation: { id: 1 } };
      await processor.process(makeJob({ event: 'installation', action: 'created', payload }));

      expect(mockService.handleInstallationCreated).toHaveBeenCalledWith({
        payload,
      });
    });

    it('should route installation.deleted to handleInstallationDeleted', async () => {
      const payload = { installation: { id: 2 } };
      await processor.process(makeJob({ event: 'installation', action: 'deleted', payload }));

      expect(mockService.handleInstallationDeleted).toHaveBeenCalledWith({
        payload,
      });
    });

    it('should route installation.suspend to handleInstallationSuspended', async () => {
      const payload = { installation: { id: 3 } };
      await processor.process(makeJob({ event: 'installation', action: 'suspend', payload }));

      expect(mockService.handleInstallationSuspended).toHaveBeenCalledWith({
        payload,
      });
    });

    it('should route installation.unsuspend to handleInstallationUnsuspended', async () => {
      const payload = { installation: { id: 4 } };
      await processor.process(makeJob({ event: 'installation', action: 'unsuspend', payload }));

      expect(mockService.handleInstallationUnsuspended).toHaveBeenCalledWith({ payload });
    });
  });

  describe('installation_repositories events', () => {
    it('should route repositories added to handleRepositoriesAdded', async () => {
      const payload = {
        installation: { id: 5 },
        repositories_added: [{ id: 100 }],
      };
      await processor.process(
        makeJob({
          event: 'installation_repositories',
          action: 'added',
          payload,
        }),
      );

      expect(mockService.handleRepositoriesAdded).toHaveBeenCalledWith({
        payload,
      });
    });

    it('should route repositories removed to handleRepositoriesRemoved', async () => {
      const payload = {
        installation: { id: 6 },
        repositories_removed: [{ id: 200 }],
      };
      await processor.process(
        makeJob({
          event: 'installation_repositories',
          action: 'removed',
          payload,
        }),
      );

      expect(mockService.handleRepositoriesRemoved).toHaveBeenCalledWith({
        payload,
      });
    });
  });

  describe('automation event routing', () => {
    it('should route non-infrastructure events to EventMatcherService', async () => {
      const payload = {
        action: 'opened',
        repository: { full_name: 'octocat/hello-world' },
        pull_request: { number: 1 },
      };
      await processor.process(makeJob({ event: 'pull_request', action: 'opened', payload }));

      expect(mockEventMatcher.findAndCreateExecutions).toHaveBeenCalledWith({
        repoFullName: 'octocat/hello-world',
        eventType: 'pull_request',
        action: 'opened',
        payload,
      });
    });

    it('should route push events to EventMatcherService', async () => {
      const payload = {
        repository: { full_name: 'octocat/hello-world' },
        ref: 'refs/heads/main',
      };
      await processor.process(makeJob({ event: 'push', action: '', payload }));

      expect(mockEventMatcher.findAndCreateExecutions).toHaveBeenCalledWith({
        repoFullName: 'octocat/hello-world',
        eventType: 'push',
        action: '',
        payload,
      });
    });

    it('should skip automation matching when payload has no repository', async () => {
      await processor.process(makeJob({ event: 'ping', action: '', payload: {} }));

      expect(mockEventMatcher.findAndCreateExecutions).not.toHaveBeenCalled();
    });

    it('should not throw for unhandled installation actions', async () => {
      await expect(
        processor.process(
          makeJob({
            event: 'installation',
            action: 'new_permissions_accepted',
          }),
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('workflow_run events', () => {
    it('should call WorkflowRunService for workflow_run.completed', async () => {
      const payload = {
        action: 'completed',
        workflow_run: { id: 5000, conclusion: 'success' },
        repository: { full_name: 'acme/widgets' },
        installation: { id: 9001 },
      };
      await processor.process(makeJob({ event: 'workflow_run', action: 'completed', payload }));

      expect(mockWorkflowRun.handleWorkflowRunCompleted).toHaveBeenCalledWith({ payload });
      // Also routes to automation matching
      expect(mockEventMatcher.findAndCreateExecutions).toHaveBeenCalledWith({
        repoFullName: 'acme/widgets',
        eventType: 'workflow_run',
        action: 'completed',
        payload,
      });
    });

    it('should only route to automation matching for non-completed workflow_run', async () => {
      const payload = {
        action: 'requested',
        workflow_run: { id: 5000 },
        repository: { full_name: 'acme/widgets' },
      };
      await processor.process(makeJob({ event: 'workflow_run', action: 'requested', payload }));

      expect(mockWorkflowRun.handleWorkflowRunCompleted).not.toHaveBeenCalled();
      expect(mockEventMatcher.findAndCreateExecutions).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should re-throw errors from service handlers', async () => {
      mockService.handleInstallationCreated.mockRejectedValue(new Error('DB connection lost'));

      await expect(
        processor.process(
          makeJob({
            event: 'installation',
            action: 'created',
            payload: { installation: { id: 1 } },
          }),
        ),
      ).rejects.toThrow('DB connection lost');
    });
  });
});
