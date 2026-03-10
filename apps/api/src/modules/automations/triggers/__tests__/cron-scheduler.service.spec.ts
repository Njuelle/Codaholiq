import { CronSchedulerService } from '../cron-scheduler.service';
import { AutomationRepository } from '../../automations.repository';
import { Queue } from 'bullmq';

function createMockAutomationRepository() {
  return {
    findCronAutomations: vi.fn().mockResolvedValue([]),
  };
}

function createMockQueue() {
  return {
    add: vi.fn().mockResolvedValue({}),
    getRepeatableJobs: vi.fn().mockResolvedValue([]),
    removeRepeatableByKey: vi.fn().mockResolvedValue(undefined),
  };
}

function makeCronAutomation(id: number, schedule = '0 * * * *', timezone?: string) {
  return {
    id,
    orgId: 10,
    repoId: 100,
    name: `cron-automation-${id}`,
    triggerType: 'cron' as const,
    triggerConfig: { schedule, ...(timezone ? { timezone } : {}) },
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('CronSchedulerService', () => {
  let service: CronSchedulerService;
  let automationRepo: ReturnType<typeof createMockAutomationRepository>;
  let queue: ReturnType<typeof createMockQueue>;

  beforeEach(() => {
    automationRepo = createMockAutomationRepository();
    queue = createMockQueue();

    service = new CronSchedulerService(
      automationRepo as unknown as AutomationRepository,
      queue as unknown as Queue,
    );
  });

  describe('registerCron', () => {
    it('should add a repeatable job to the queue', async () => {
      await service.registerCron({
        automationId: 1,
        schedule: '0 * * * *',
      });

      expect(queue.add).toHaveBeenCalledWith(
        'cron:1',
        { automationId: 1 },
        {
          repeat: { pattern: '0 * * * *' },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );
    });

    it('should include timezone when provided', async () => {
      await service.registerCron({
        automationId: 1,
        schedule: '0 9 * * 1-5',
        timezone: 'America/New_York',
      });

      expect(queue.add).toHaveBeenCalledWith(
        'cron:1',
        { automationId: 1 },
        {
          repeat: { pattern: '0 9 * * 1-5', tz: 'America/New_York' },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );
    });
  });

  describe('unregisterCron', () => {
    it('should remove the repeatable job by key', async () => {
      queue.getRepeatableJobs.mockResolvedValue([
        { name: 'cron:1', key: 'repeat:cron:1:pattern:0 * * * *' },
      ]);

      await service.unregisterCron({ automationId: 1 });

      expect(queue.removeRepeatableByKey).toHaveBeenCalledWith('repeat:cron:1:pattern:0 * * * *');
    });

    it('should do nothing when job not found', async () => {
      queue.getRepeatableJobs.mockResolvedValue([]);

      await service.unregisterCron({ automationId: 999 });

      expect(queue.removeRepeatableByKey).not.toHaveBeenCalled();
    });
  });

  describe('updateCron', () => {
    it('should unregister old and register new', async () => {
      queue.getRepeatableJobs.mockResolvedValue([{ name: 'cron:1', key: 'repeat:cron:1:old' }]);

      await service.updateCron({
        automationId: 1,
        schedule: '*/10 * * * *',
      });

      expect(queue.removeRepeatableByKey).toHaveBeenCalledWith('repeat:cron:1:old');
      expect(queue.add).toHaveBeenCalledWith(
        'cron:1',
        { automationId: 1 },
        expect.objectContaining({
          repeat: { pattern: '*/10 * * * *' },
        }),
      );
    });
  });

  describe('syncAllCrons', () => {
    it('should register missing cron automations', async () => {
      automationRepo.findCronAutomations.mockResolvedValue([
        makeCronAutomation(1, '0 * * * *'),
        makeCronAutomation(2, '*/15 * * * *'),
      ]);
      queue.getRepeatableJobs.mockResolvedValue([]);

      await service.syncAllCrons();

      expect(queue.add).toHaveBeenCalledTimes(2);
    });

    it('should remove stale cron jobs', async () => {
      automationRepo.findCronAutomations.mockResolvedValue([]);
      queue.getRepeatableJobs.mockResolvedValue([{ name: 'cron:99', key: 'repeat:cron:99:stale' }]);

      await service.syncAllCrons();

      expect(queue.removeRepeatableByKey).toHaveBeenCalledWith('repeat:cron:99:stale');
    });

    it('should not touch already-synced jobs', async () => {
      automationRepo.findCronAutomations.mockResolvedValue([makeCronAutomation(1, '0 * * * *')]);
      queue.getRepeatableJobs.mockResolvedValue([{ name: 'cron:1', key: 'repeat:cron:1:ok' }]);

      await service.syncAllCrons();

      expect(queue.add).not.toHaveBeenCalled();
      expect(queue.removeRepeatableByKey).not.toHaveBeenCalled();
    });

    it('should handle empty DB (no crons)', async () => {
      automationRepo.findCronAutomations.mockResolvedValue([]);
      queue.getRepeatableJobs.mockResolvedValue([]);

      await service.syncAllCrons();

      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('onModuleInit', () => {
    it('should call syncAllCrons', async () => {
      automationRepo.findCronAutomations.mockResolvedValue([]);
      queue.getRepeatableJobs.mockResolvedValue([]);

      await service.onModuleInit();

      expect(automationRepo.findCronAutomations).toHaveBeenCalled();
    });

    it('should re-throw if sync fails so NestJS reports startup failure', async () => {
      automationRepo.findCronAutomations.mockRejectedValue(new Error('DB error'));

      await expect(service.onModuleInit()).rejects.toThrow('DB error');
    });
  });
});
