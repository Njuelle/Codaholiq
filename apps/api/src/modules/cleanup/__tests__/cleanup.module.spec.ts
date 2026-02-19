import { CleanupModule } from '../cleanup.module';
import {
  EXECUTION_CLEANUP_JOB,
  AUDIT_CLEANUP_JOB,
  NOTIFICATION_CLEANUP_JOB,
  REFRESH_TOKEN_CLEANUP_JOB,
} from '../cleanup.constants';

function createMockQueue() {
  return {
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
  };
}

function createMockConfigService(overrides: Record<string, string> = {}) {
  return {
    get: vi.fn().mockImplementation((key: string) => overrides[key] ?? undefined),
  };
}

describe('CleanupModule', () => {
  it('should schedule all four cleanup jobs on init', async () => {
    const queue = createMockQueue();
    const config = createMockConfigService();

    const mod = new CleanupModule(queue as never, config as never);
    await mod.onModuleInit();

    expect(queue.add).toHaveBeenCalledTimes(4);
    expect(queue.add).toHaveBeenCalledWith(
      EXECUTION_CLEANUP_JOB,
      { retentionDays: 90 },
      expect.objectContaining({ repeat: { pattern: '0 3 * * *' } }),
    );
    expect(queue.add).toHaveBeenCalledWith(
      AUDIT_CLEANUP_JOB,
      { retentionDays: 180 },
      expect.objectContaining({ repeat: { pattern: '0 4 * * *' } }),
    );
    expect(queue.add).toHaveBeenCalledWith(
      NOTIFICATION_CLEANUP_JOB,
      { retentionDays: 30 },
      expect.objectContaining({ repeat: { pattern: '0 5 * * *' } }),
    );
    expect(queue.add).toHaveBeenCalledWith(
      REFRESH_TOKEN_CLEANUP_JOB,
      { retentionDays: 30 },
      expect.objectContaining({ repeat: { pattern: '0 2 * * *' } }),
    );
  });

  it('should use custom retention days from config', async () => {
    const queue = createMockQueue();
    const config = createMockConfigService({
      EXECUTION_RETENTION_DAYS: '30',
      AUDIT_RETENTION_DAYS: '60',
      NOTIFICATION_RETENTION_DAYS: '7',
    });

    const mod = new CleanupModule(queue as never, config as never);
    await mod.onModuleInit();

    expect(queue.add).toHaveBeenCalledWith(
      EXECUTION_CLEANUP_JOB,
      { retentionDays: 30 },
      expect.any(Object),
    );
    expect(queue.add).toHaveBeenCalledWith(
      AUDIT_CLEANUP_JOB,
      { retentionDays: 60 },
      expect.any(Object),
    );
    expect(queue.add).toHaveBeenCalledWith(
      NOTIFICATION_CLEANUP_JOB,
      { retentionDays: 7 },
      expect.any(Object),
    );
  });

  it('should not throw when scheduling fails', async () => {
    const queue = createMockQueue();
    queue.add.mockRejectedValue(new Error('Redis unavailable'));
    const config = createMockConfigService();

    const mod = new CleanupModule(queue as never, config as never);

    await expect(mod.onModuleInit()).resolves.toBeUndefined();
  });
});
