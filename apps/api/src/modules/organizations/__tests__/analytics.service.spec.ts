import { AnalyticsService } from '../analytics.service';
import type { ExecutionsService } from '../../executions/executions.service';

const emptyCostResult = {
  totalCostMicros: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  executionsWithCost: 0,
};

function createMockExecutionsService() {
  return {
    getCostOverTime: vi.fn().mockResolvedValue([]),
    getCostStats: vi.fn().mockResolvedValue(emptyCostResult),
    getCostByProvider: vi.fn().mockResolvedValue([]),
    getTopCostliestAutomations: vi.fn().mockResolvedValue([]),
  };
}

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let executionsService: ReturnType<typeof createMockExecutionsService>;

  beforeEach(() => {
    executionsService = createMockExecutionsService();
    service = new AnalyticsService(executionsService as unknown as ExecutionsService);
  });

  describe('getCostAnalytics', () => {
    const from = new Date('2026-01-01T00:00:00Z');
    const to = new Date('2026-02-01T00:00:00Z');

    it('should return combined analytics data', async () => {
      executionsService.getCostOverTime.mockResolvedValue([
        {
          date: '2026-01-15',
          totalCostMicros: 500000,
          totalInputTokens: 1000,
          totalOutputTokens: 500,
          executionCount: 2,
        },
      ]);
      executionsService.getCostStats.mockResolvedValue({
        totalCostMicros: 500000,
        totalInputTokens: 1000,
        totalOutputTokens: 500,
        executionsWithCost: 2,
      });
      executionsService.getCostByProvider.mockResolvedValue([
        { provider: 'claude-code', model: 'opus', totalCostMicros: 500000, count: 2 },
      ]);
      executionsService.getTopCostliestAutomations.mockResolvedValue([
        {
          automationId: 1,
          automationName: 'test',
          totalCostMicros: 500000,
          executionCount: 2,
          totalInputTokens: 1000,
          totalOutputTokens: 500,
        },
      ]);

      const result = await service.getCostAnalytics({ orgId: 10, from, to });

      expect(result.series).toHaveLength(1);
      expect(result.series[0].date).toBe('2026-01-15');
      expect(result.summary.totalCostMicros).toBe(500000);
      expect(result.summary.averageCostMicros).toBe(250000);
      expect(result.costByProvider).toHaveLength(1);
      expect(result.topCostliestAutomations).toHaveLength(1);
    });

    it('should return zero average when no executions have cost', async () => {
      const result = await service.getCostAnalytics({ orgId: 10, from, to });

      expect(result.summary.averageCostMicros).toBe(0);
      expect(result.series).toEqual([]);
    });

    it('should pass correct params to executionsService', async () => {
      await service.getCostAnalytics({ orgId: 10, from, to });

      expect(executionsService.getCostOverTime).toHaveBeenCalledWith({
        orgId: 10,
        from,
        to,
        repoId: undefined,
      });
      expect(executionsService.getCostStats).toHaveBeenCalledWith({
        orgId: 10,
        since: from,
        repoId: undefined,
      });
      expect(executionsService.getCostByProvider).toHaveBeenCalledWith({
        orgId: 10,
        since: from,
        repoId: undefined,
      });
      expect(executionsService.getTopCostliestAutomations).toHaveBeenCalledWith({
        orgId: 10,
        since: from,
        limit: 10,
        repoId: undefined,
      });
    });

    it('should pass repoId to all data sources when provided', async () => {
      await service.getCostAnalytics({ orgId: 10, from, to, repoId: 42 });

      expect(executionsService.getCostOverTime).toHaveBeenCalledWith({
        orgId: 10,
        from,
        to,
        repoId: 42,
      });
      expect(executionsService.getCostStats).toHaveBeenCalledWith({
        orgId: 10,
        since: from,
        repoId: 42,
      });
      expect(executionsService.getCostByProvider).toHaveBeenCalledWith({
        orgId: 10,
        since: from,
        repoId: 42,
      });
      expect(executionsService.getTopCostliestAutomations).toHaveBeenCalledWith({
        orgId: 10,
        since: from,
        limit: 10,
        repoId: 42,
      });
    });

    it('should call all four data sources in parallel', async () => {
      const callOrder: string[] = [];
      executionsService.getCostOverTime.mockImplementation(() => {
        callOrder.push('costOverTime');
        return Promise.resolve([]);
      });
      executionsService.getCostStats.mockImplementation(() => {
        callOrder.push('costStats');
        return Promise.resolve(emptyCostResult);
      });
      executionsService.getCostByProvider.mockImplementation(() => {
        callOrder.push('costByProvider');
        return Promise.resolve([]);
      });
      executionsService.getTopCostliestAutomations.mockImplementation(() => {
        callOrder.push('topCostliest');
        return Promise.resolve([]);
      });

      await service.getCostAnalytics({ orgId: 10, from, to });

      expect(callOrder).toHaveLength(4);
    });
  });
});
