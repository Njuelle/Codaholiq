import { Job } from 'bullmq';
import { CleanupProcessor } from '../cleanup.processor';
import {
  EXECUTION_CLEANUP_JOB,
  AUDIT_CLEANUP_JOB,
  NOTIFICATION_CLEANUP_JOB,
  REFRESH_TOKEN_CLEANUP_JOB,
  type CleanupJobData,
} from '../cleanup.constants';

function createMockExecutionRepository() {
  return {
    deleteLogsOlderThan: vi.fn().mockResolvedValue(50),
    deleteExecutionsOlderThan: vi.fn().mockResolvedValue(10),
  };
}

function createMockAuditRepository() {
  return {
    deleteOlderThan: vi.fn().mockResolvedValue(20),
  };
}

function createMockNotificationRepository() {
  return {
    deleteOlderThan: vi.fn().mockResolvedValue(5),
  };
}

function createMockAuthRepository() {
  return {
    deleteExpiredTokens: vi.fn().mockResolvedValue(3),
  };
}

function makeJob(name: string, retentionDays: number): Job<CleanupJobData> {
  return { name, data: { retentionDays } } as Job<CleanupJobData>;
}

describe('CleanupProcessor', () => {
  let processor: CleanupProcessor;
  let executionRepo: ReturnType<typeof createMockExecutionRepository>;
  let auditRepo: ReturnType<typeof createMockAuditRepository>;
  let notificationRepo: ReturnType<typeof createMockNotificationRepository>;
  let authRepo: ReturnType<typeof createMockAuthRepository>;

  beforeEach(() => {
    executionRepo = createMockExecutionRepository();
    auditRepo = createMockAuditRepository();
    notificationRepo = createMockNotificationRepository();
    authRepo = createMockAuthRepository();

    processor = new CleanupProcessor(
      executionRepo as never,
      auditRepo as never,
      notificationRepo as never,
      authRepo as never,
    );
  });

  it('should delete old execution logs and executions', async () => {
    await processor.process(makeJob(EXECUTION_CLEANUP_JOB, 90));

    expect(executionRepo.deleteLogsOlderThan).toHaveBeenCalledWith({ days: 90 });
    expect(executionRepo.deleteExecutionsOlderThan).toHaveBeenCalledWith({ days: 90 });
  });

  it('should delete old audit entries', async () => {
    await processor.process(makeJob(AUDIT_CLEANUP_JOB, 180));

    expect(auditRepo.deleteOlderThan).toHaveBeenCalledWith({ days: 180 });
  });

  it('should delete old notifications', async () => {
    await processor.process(makeJob(NOTIFICATION_CLEANUP_JOB, 30));

    expect(notificationRepo.deleteOlderThan).toHaveBeenCalledWith({ days: 30 });
  });

  it('should delete expired refresh tokens', async () => {
    await processor.process(makeJob(REFRESH_TOKEN_CLEANUP_JOB, 30));

    expect(authRepo.deleteExpiredTokens).toHaveBeenCalledWith({ days: 30 });
  });

  it('should warn on unknown job name', async () => {
    const warnSpy = vi.spyOn(processor['logger'], 'warn');

    await processor.process(makeJob('unknown-job', 7));

    expect(warnSpy).toHaveBeenCalledWith('Unknown cleanup job: unknown-job');
  });
});
