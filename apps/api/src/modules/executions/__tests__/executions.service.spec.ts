import { NotFoundException } from '@nestjs/common';
import { ExecutionsService } from '../executions.service';
import type { ExecutionRepository } from '../executions.repository';
import type { ExecutionLifecycleService } from '../execution-lifecycle.service';
import type { RedisLogPublisherService } from '../redis-log-publisher.service';

function createMockRedisLogPublisher() {
  return {
    publishLog: vi.fn().mockResolvedValue(undefined),
    publishStatus: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockReturnValue(vi.fn()),
  };
}

function createMockExecutionRepository() {
  return {
    findByOrgId: vi.fn().mockResolvedValue([]),
    countByOrgId: vi.fn().mockResolvedValue(0),
    findById: vi.fn(),
    findLogs: vi.fn().mockResolvedValue([]),
    countByStatus: vi.fn().mockResolvedValue([]),
    sumCostInDateRange: vi.fn().mockResolvedValue({
      totalCostMicros: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      executionsWithCost: 0,
    }),
    sumCostByProviderInDateRange: vi.fn().mockResolvedValue([]),
    topCostliestAutomations: vi.fn().mockResolvedValue([]),
    countByStatusInDateRange: vi.fn().mockResolvedValue([]),
  };
}

function createMockLifecycleService() {
  return {
    cancel: vi.fn().mockResolvedValue(undefined),
    retry: vi.fn(),
  };
}

describe('ExecutionsService', () => {
  let service: ExecutionsService;
  let executionRepo: ReturnType<typeof createMockExecutionRepository>;
  let lifecycleService: ReturnType<typeof createMockLifecycleService>;

  beforeEach(() => {
    executionRepo = createMockExecutionRepository();
    lifecycleService = createMockLifecycleService();
    service = new ExecutionsService(
      executionRepo as unknown as ExecutionRepository,
      lifecycleService as unknown as ExecutionLifecycleService,
      createMockRedisLogPublisher() as unknown as RedisLogPublisherService,
    );
  });

  describe('list', () => {
    it('should return items and total', async () => {
      executionRepo.findByOrgId.mockResolvedValue([{ execution: { id: 1 } }]);
      executionRepo.countByOrgId.mockResolvedValue(1);

      const result = await service.list({ orgId: 10, filters: {} });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should pass filters through', async () => {
      await service.list({
        orgId: 10,
        filters: { status: 'failed', automationId: 5, limit: 10 },
      });

      expect(executionRepo.findByOrgId).toHaveBeenCalledWith({
        orgId: 10,
        filters: expect.objectContaining({
          status: 'failed',
          automationId: 5,
          limit: 10,
        }),
      });
    });
  });

  describe('findById', () => {
    it('should return execution with automation name', async () => {
      executionRepo.findById.mockResolvedValue({
        execution: { id: 1, status: 'completed' },
        automationName: 'test-auto',
        orgId: 10,
      });

      const result = await service.findById({ orgId: 10, executionId: 1 });

      expect(result.automationName).toBe('test-auto');
    });

    it('should throw NotFoundException if execution not found', async () => {
      executionRepo.findById.mockResolvedValue(undefined);

      await expect(service.findById({ orgId: 10, executionId: 999 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if execution belongs to different org', async () => {
      executionRepo.findById.mockResolvedValue({
        execution: { id: 1 },
        automationName: 'test',
        orgId: 20,
      });

      await expect(service.findById({ orgId: 10, executionId: 1 })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findLogs', () => {
    it('should return logs for execution', async () => {
      executionRepo.findById.mockResolvedValue({
        execution: { id: 1 },
        automationName: 'test',
        orgId: 10,
      });
      executionRepo.findLogs.mockResolvedValue([
        { id: 1, message: 'log1' },
        { id: 2, message: 'log2' },
      ]);

      const result = await service.findLogs({ orgId: 10, executionId: 1 });

      expect(result).toHaveLength(2);
    });

    it('should pass limit to repository', async () => {
      executionRepo.findById.mockResolvedValue({
        execution: { id: 1 },
        automationName: 'test',
        orgId: 10,
      });
      executionRepo.findLogs.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      await service.findLogs({
        orgId: 10,
        executionId: 1,
        limit: 2,
      });

      expect(executionRepo.findLogs).toHaveBeenCalledWith({
        executionId: 1,
        after: undefined,
        limit: 2,
      });
    });

    it('should throw NotFoundException if execution not in org', async () => {
      executionRepo.findById.mockResolvedValue(undefined);

      await expect(service.findLogs({ orgId: 10, executionId: 999 })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('cancel', () => {
    it('should delegate to lifecycle service', async () => {
      executionRepo.findById.mockResolvedValue({
        execution: { id: 1 },
        automationName: 'test',
        orgId: 10,
      });

      await service.cancel({ orgId: 10, executionId: 1 });

      expect(lifecycleService.cancel).toHaveBeenCalledWith({ executionId: 1 });
    });

    it('should throw NotFoundException if not in org', async () => {
      executionRepo.findById.mockResolvedValue(undefined);

      await expect(service.cancel({ orgId: 10, executionId: 999 })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('retry', () => {
    it('should delegate to lifecycle service', async () => {
      executionRepo.findById.mockResolvedValue({
        execution: { id: 1 },
        automationName: 'test',
        orgId: 10,
      });
      lifecycleService.retry.mockResolvedValue({ id: 2, status: 'pending' });

      const result = await service.retry({ orgId: 10, executionId: 1 });

      expect(result.id).toBe(2);
      expect(lifecycleService.retry).toHaveBeenCalledWith({ executionId: 1 });
    });
  });

  describe('getStats', () => {
    it('should return counts by status', async () => {
      executionRepo.countByStatus.mockResolvedValue([
        { status: 'completed', count: 5 },
        { status: 'failed', count: 2 },
      ]);

      const result = await service.getStats({ orgId: 10 });

      expect(result.byStatus).toHaveLength(2);
    });
  });

  describe('streamLogs', () => {
    it('should return an Observable', () => {
      executionRepo.findById.mockResolvedValue({
        execution: { id: 1, status: 'completed' },
        automationName: 'test',
        orgId: 10,
      });
      executionRepo.findLogs.mockResolvedValue([]);

      const observable = service.streamLogs({ orgId: 10, executionId: 1 });

      expect(observable).toBeDefined();
      expect(typeof observable.subscribe).toBe('function');
    });

    it('should emit status event and complete for terminal execution', async () => {
      executionRepo.findById.mockResolvedValue({
        execution: { id: 1, status: 'completed' },
        automationName: 'test',
        orgId: 10,
      });
      executionRepo.findLogs.mockResolvedValue([]);

      const events: { data: string; type?: string }[] = [];

      await new Promise<void>((resolve) => {
        const sub = service.streamLogs({ orgId: 10, executionId: 1 }).subscribe({
          next: (event) => events.push(event),
          complete: () => {
            sub.unsubscribe();
            resolve();
          },
        });
      });

      const statusEvent = events.find((e) => e.type === 'status');
      expect(statusEvent).toBeDefined();
      expect(JSON.parse(statusEvent!.data)).toEqual({ status: 'completed' });
    });

    it('should complete immediately if execution not found', async () => {
      executionRepo.findById.mockResolvedValue(undefined);

      await new Promise<void>((resolve) => {
        const sub = service.streamLogs({ orgId: 10, executionId: 999 }).subscribe({
          complete: () => {
            sub.unsubscribe();
            resolve();
          },
        });
      });
    });
  });

  describe('getCostStats', () => {
    it('should delegate to repository', async () => {
      const expected = {
        totalCostMicros: 500000,
        totalInputTokens: 10000,
        totalOutputTokens: 2000,
        executionsWithCost: 5,
      };
      executionRepo.sumCostInDateRange.mockResolvedValue(expected);
      const since = new Date();

      const result = await service.getCostStats({ orgId: 10, since });

      expect(result).toEqual(expected);
      expect(executionRepo.sumCostInDateRange).toHaveBeenCalledWith({ orgId: 10, since });
    });
  });

  describe('getCostByProvider', () => {
    it('should delegate to repository', async () => {
      const expected = [{ provider: 'claude-code', model: null, totalCostMicros: 100, count: 1 }];
      executionRepo.sumCostByProviderInDateRange.mockResolvedValue(expected);
      const since = new Date();

      const result = await service.getCostByProvider({ orgId: 10, since });

      expect(result).toEqual(expected);
    });
  });

  describe('getTopCostliestAutomations', () => {
    it('should delegate to repository with limit', async () => {
      const expected = [
        {
          automationId: 1,
          automationName: 'Bot',
          totalCostMicros: 500000,
          executionCount: 10,
          totalInputTokens: 5000,
          totalOutputTokens: 1000,
        },
      ];
      executionRepo.topCostliestAutomations.mockResolvedValue(expected);
      const since = new Date();

      const result = await service.getTopCostliestAutomations({ orgId: 10, since, limit: 5 });

      expect(result).toEqual(expected);
      expect(executionRepo.topCostliestAutomations).toHaveBeenCalledWith({
        orgId: 10,
        since,
        limit: 5,
      });
    });
  });
});
