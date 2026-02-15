import { DashboardService } from '../dashboard.service';
import type { ExecutionsService } from '../../executions/executions.service';
import type { AutomationService } from '../../automations/automations.service';
import type { RepositoriesService } from '../../github/repositories.service';

function createMockExecutionsService() {
  return {
    listRecent: vi.fn().mockResolvedValue([]),
    countByStatusInDateRange: vi.fn().mockResolvedValue([]),
  };
}

function createMockAutomationService() {
  return {
    countByOrgId: vi.fn().mockResolvedValue(0),
    findCronAutomationsByOrgId: vi.fn().mockResolvedValue([]),
  };
}

function createMockRepositoriesService() {
  return {
    countByOrgId: vi.fn().mockResolvedValue(0),
  };
}

describe('DashboardService', () => {
  let service: DashboardService;
  let executionsService: ReturnType<typeof createMockExecutionsService>;
  let automationService: ReturnType<typeof createMockAutomationService>;
  let repositoriesService: ReturnType<typeof createMockRepositoriesService>;

  beforeEach(() => {
    executionsService = createMockExecutionsService();
    automationService = createMockAutomationService();
    repositoriesService = createMockRepositoriesService();
    service = new DashboardService(
      executionsService as unknown as ExecutionsService,
      automationService as unknown as AutomationService,
      repositoriesService as unknown as RepositoriesService,
    );
  });

  describe('getStats', () => {
    it('should return all dashboard stats', async () => {
      executionsService.listRecent.mockResolvedValue([
        {
          execution: { id: 1, status: 'completed', createdAt: new Date() },
          automationName: 'auto-1',
        },
      ]);
      executionsService.countByStatusInDateRange.mockResolvedValue([
        { status: 'completed', count: 5 },
        { status: 'failed', count: 2 },
        { status: 'running', count: 1 },
      ]);
      automationService.countByOrgId.mockResolvedValue(3);
      repositoriesService.countByOrgId.mockResolvedValue(10);

      const result = await service.getStats({ orgId: 10 });

      expect(result.recentExecutions).toHaveLength(1);
      expect(result.activeAutomationsCount).toBe(3);
      expect(result.repositoryCount).toBe(10);
      expect(result.executionStats.last24h).toEqual({
        total: 8,
        completed: 5,
        failed: 2,
        running: 1,
      });
    });

    it('should return zero counts when no executions exist', async () => {
      const result = await service.getStats({ orgId: 10 });

      expect(result.recentExecutions).toEqual([]);
      expect(result.executionStats.last24h).toEqual({
        total: 0,
        completed: 0,
        failed: 0,
        running: 0,
      });
      expect(result.activeAutomationsCount).toBe(0);
      expect(result.repositoryCount).toBe(0);
      expect(result.upcomingCronTriggers).toEqual([]);
    });

    it('should call listRecent with limit 10 for recent executions', async () => {
      await service.getStats({ orgId: 10 });

      expect(executionsService.listRecent).toHaveBeenCalledWith({
        orgId: 10,
        limit: 10,
      });
    });

    it('should call countByStatusInDateRange with three time ranges', async () => {
      await service.getStats({ orgId: 10 });

      expect(executionsService.countByStatusInDateRange).toHaveBeenCalledTimes(3);
    });

    it('should call countByOrgId with enabled filter for active automations', async () => {
      await service.getStats({ orgId: 10 });

      expect(automationService.countByOrgId).toHaveBeenCalledWith({
        orgId: 10,
        enabled: true,
      });
    });

    it('should compute upcoming cron triggers from cron automations', async () => {
      automationService.findCronAutomationsByOrgId.mockResolvedValue([
        {
          id: 1,
          name: 'Daily check',
          triggerConfig: { schedule: '0 0 * * *' },
          orgId: 10,
          repoId: 1,
          triggerType: 'cron',
          enabled: true,
        },
      ]);

      const result = await service.getStats({ orgId: 10 });

      expect(result.upcomingCronTriggers).toHaveLength(1);
      expect(result.upcomingCronTriggers[0].automationId).toBe(1);
      expect(result.upcomingCronTriggers[0].automationName).toBe('Daily check');
      expect(result.upcomingCronTriggers[0].nextFireAt).toBeDefined();
    });

    it('should limit upcoming cron triggers to 5', async () => {
      const cronAutomations = Array.from({ length: 8 }, (_, i) => ({
        id: i + 1,
        name: `cron-${i + 1}`,
        triggerConfig: { schedule: `${i * 5} * * * *` },
        orgId: 10,
        repoId: 1,
        triggerType: 'cron' as const,
        enabled: true,
      }));
      automationService.findCronAutomationsByOrgId.mockResolvedValue(cronAutomations);

      const result = await service.getStats({ orgId: 10 });

      expect(result.upcomingCronTriggers).toHaveLength(5);
    });

    it('should sort upcoming cron triggers by next fire time', async () => {
      automationService.findCronAutomationsByOrgId.mockResolvedValue([
        {
          id: 1,
          name: 'Weekly',
          triggerConfig: { schedule: '0 0 * * 0' },
          orgId: 10,
          repoId: 1,
          triggerType: 'cron',
          enabled: true,
        },
        {
          id: 2,
          name: 'Every minute',
          triggerConfig: { schedule: '* * * * *' },
          orgId: 10,
          repoId: 1,
          triggerType: 'cron',
          enabled: true,
        },
      ]);

      const result = await service.getStats({ orgId: 10 });

      expect(result.upcomingCronTriggers.length).toBeGreaterThanOrEqual(2);
      const [first, second] = result.upcomingCronTriggers;
      expect(new Date(first.nextFireAt).getTime()).toBeLessThanOrEqual(
        new Date(second.nextFireAt).getTime(),
      );
    });

    it('should skip automations with invalid cron expressions', async () => {
      automationService.findCronAutomationsByOrgId.mockResolvedValue([
        {
          id: 1,
          name: 'Invalid',
          triggerConfig: { schedule: 'not-a-cron' },
          orgId: 10,
          repoId: 1,
          triggerType: 'cron',
          enabled: true,
        },
        {
          id: 2,
          name: 'Valid',
          triggerConfig: { schedule: '0 0 * * *' },
          orgId: 10,
          repoId: 1,
          triggerType: 'cron',
          enabled: true,
        },
      ]);

      const result = await service.getStats({ orgId: 10 });

      expect(result.upcomingCronTriggers).toHaveLength(1);
      expect(result.upcomingCronTriggers[0].automationName).toBe('Valid');
    });

    it('should skip automations with missing schedule in config', async () => {
      automationService.findCronAutomationsByOrgId.mockResolvedValue([
        {
          id: 1,
          name: 'No schedule',
          triggerConfig: {},
          orgId: 10,
          repoId: 1,
          triggerType: 'cron',
          enabled: true,
        },
      ]);

      const result = await service.getStats({ orgId: 10 });

      expect(result.upcomingCronTriggers).toEqual([]);
    });
  });
});
