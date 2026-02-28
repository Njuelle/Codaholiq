import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, type CanActivate, type ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import type { Request } from 'express';
import { DashboardController } from '../dashboard.controller';
import { DashboardService, type DashboardStats } from '../dashboard.service';
import { OrgGuard } from '../../../common/guards/org.guard';
import { TransformInterceptor } from '../../../common/interceptors/transform.interceptor';

function createMockDashboardService() {
  return {
    getStats: vi.fn(),
  };
}

const mockOrgGuard: CanActivate = {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    req.user = { sub: 1, username: 'testuser', avatarUrl: null, iat: 0, exp: 0 };
    req.orgMember = { orgId: Number(req.params.orgId), userId: 1, role: 'member' };
    return true;
  },
};

const emptyCostStats = {
  totalCostMicros: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  executionsWithCost: 0,
  averageCostMicros: 0,
};

function makeStats(overrides: Partial<DashboardStats> = {}): DashboardStats {
  return {
    recentExecutions: [],
    executionStats: {
      last24h: { total: 0, completed: 0, failed: 0, running: 0 },
      last7d: { total: 0, completed: 0, failed: 0, running: 0 },
      last30d: { total: 0, completed: 0, failed: 0, running: 0 },
    },
    costStats: {
      last24h: emptyCostStats,
      last7d: emptyCostStats,
      last30d: emptyCostStats,
    },
    costByProvider: [],
    topCostliestAutomations: [],
    activeAutomationsCount: 0,
    repositoryCount: 0,
    upcomingCronTriggers: [],
    ...overrides,
  };
}

describe('DashboardController', () => {
  let app: INestApplication;
  let dashboardService: ReturnType<typeof createMockDashboardService>;

  beforeAll(async () => {
    dashboardService = createMockDashboardService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: dashboardService }],
    })
      .overrideGuard(OrgGuard)
      .useValue(mockOrgGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /orgs/:orgId/dashboard', () => {
    it('should return dashboard stats wrapped in data envelope', async () => {
      dashboardService.getStats.mockResolvedValue(
        makeStats({
          activeAutomationsCount: 5,
          repositoryCount: 12,
        }),
      );

      const response = await request(app.getHttpServer()).get('/orgs/10/dashboard').expect(200);

      expect(response.body.data.activeAutomationsCount).toBe(5);
      expect(response.body.data.repositoryCount).toBe(12);
      expect(response.body.requestId).toBeDefined();
    });

    it('should pass orgId to service', async () => {
      dashboardService.getStats.mockResolvedValue(makeStats());

      await request(app.getHttpServer()).get('/orgs/10/dashboard').expect(200);

      expect(dashboardService.getStats).toHaveBeenCalledWith({ orgId: 10 });
    });

    it('should return execution stats with time ranges', async () => {
      dashboardService.getStats.mockResolvedValue(
        makeStats({
          executionStats: {
            last24h: { total: 10, completed: 7, failed: 2, running: 1 },
            last7d: { total: 50, completed: 40, failed: 8, running: 2 },
            last30d: { total: 200, completed: 180, failed: 15, running: 5 },
          },
        }),
      );

      const response = await request(app.getHttpServer()).get('/orgs/10/dashboard').expect(200);

      expect(response.body.data.executionStats.last24h.total).toBe(10);
      expect(response.body.data.executionStats.last7d.total).toBe(50);
      expect(response.body.data.executionStats.last30d.total).toBe(200);
    });

    it('should return recent executions', async () => {
      dashboardService.getStats.mockResolvedValue(
        makeStats({
          recentExecutions: [
            {
              execution: { id: 1, status: 'completed', createdAt: new Date() },
              automationName: 'test-auto',
            },
          ],
        }),
      );

      const response = await request(app.getHttpServer()).get('/orgs/10/dashboard').expect(200);

      expect(response.body.data.recentExecutions).toHaveLength(1);
      expect(response.body.data.recentExecutions[0].automationName).toBe('test-auto');
    });

    it('should return upcoming cron triggers', async () => {
      dashboardService.getStats.mockResolvedValue(
        makeStats({
          upcomingCronTriggers: [
            {
              automationId: 1,
              automationName: 'Daily check',
              nextFireAt: '2026-02-10T00:00:00.000Z',
            },
          ],
        }),
      );

      const response = await request(app.getHttpServer()).get('/orgs/10/dashboard').expect(200);

      expect(response.body.data.upcomingCronTriggers).toHaveLength(1);
      expect(response.body.data.upcomingCronTriggers[0].automationName).toBe('Daily check');
    });

    it('should return 400 for non-numeric orgId', async () => {
      await request(app.getHttpServer()).get('/orgs/abc/dashboard').expect(400);
    });
  });
});
