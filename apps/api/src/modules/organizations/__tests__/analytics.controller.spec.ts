import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, type CanActivate, type ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import type { Request } from 'express';
import { AnalyticsController } from '../analytics.controller';
import { AnalyticsService, type AnalyticsData } from '../analytics.service';
import { OrgGuard } from '../../../common/guards/org.guard';
import { TransformInterceptor } from '../../../common/interceptors/transform.interceptor';

function createMockAnalyticsService() {
  return {
    getCostAnalytics: vi.fn(),
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

function makeAnalyticsData(overrides: Partial<AnalyticsData> = {}): AnalyticsData {
  return {
    series: [],
    summary: {
      totalCostMicros: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      executionsWithCost: 0,
      averageCostMicros: 0,
    },
    costByProvider: [],
    topCostliestAutomations: [],
    ...overrides,
  };
}

describe('AnalyticsController', () => {
  let app: INestApplication;
  let analyticsService: ReturnType<typeof createMockAnalyticsService>;

  beforeAll(async () => {
    analyticsService = createMockAnalyticsService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [{ provide: AnalyticsService, useValue: analyticsService }],
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

  describe('GET /orgs/:orgId/analytics/cost-over-time', () => {
    const validFrom = '2026-01-01T00:00:00.000Z';
    const validTo = '2026-02-01T00:00:00.000Z';

    it('should return analytics data wrapped in data envelope', async () => {
      analyticsService.getCostAnalytics.mockResolvedValue(
        makeAnalyticsData({
          series: [
            {
              date: '2026-01-15',
              totalCostMicros: 500000,
              totalInputTokens: 1000,
              totalOutputTokens: 500,
              executionCount: 2,
            },
          ],
        }),
      );

      const response = await request(app.getHttpServer())
        .get(`/orgs/10/analytics/cost-over-time?from=${validFrom}&to=${validTo}`)
        .expect(200);

      expect(response.body.data.series).toHaveLength(1);
      expect(response.body.data.series[0].date).toBe('2026-01-15');
      expect(response.body.requestId).toBeDefined();
    });

    it('should pass orgId and date range to service', async () => {
      analyticsService.getCostAnalytics.mockResolvedValue(makeAnalyticsData());

      await request(app.getHttpServer())
        .get(`/orgs/10/analytics/cost-over-time?from=${validFrom}&to=${validTo}`)
        .expect(200);

      expect(analyticsService.getCostAnalytics).toHaveBeenCalledWith({
        orgId: 10,
        from: new Date(validFrom),
        to: new Date(validTo),
        repoId: undefined,
      });
    });

    it('should pass repoId to service when provided', async () => {
      analyticsService.getCostAnalytics.mockResolvedValue(makeAnalyticsData());

      await request(app.getHttpServer())
        .get(`/orgs/10/analytics/cost-over-time?from=${validFrom}&to=${validTo}&repoId=42`)
        .expect(200);

      expect(analyticsService.getCostAnalytics).toHaveBeenCalledWith({
        orgId: 10,
        from: new Date(validFrom),
        to: new Date(validTo),
        repoId: 42,
      });
    });

    it('should return 400 for invalid repoId', async () => {
      await request(app.getHttpServer())
        .get(`/orgs/10/analytics/cost-over-time?from=${validFrom}&to=${validTo}&repoId=abc`)
        .expect(400);
    });

    it('should return 400 when from is missing', async () => {
      await request(app.getHttpServer())
        .get(`/orgs/10/analytics/cost-over-time?to=${validTo}`)
        .expect(400);
    });

    it('should return 400 when to is missing', async () => {
      await request(app.getHttpServer())
        .get(`/orgs/10/analytics/cost-over-time?from=${validFrom}`)
        .expect(400);
    });

    it('should return 400 when from is after to', async () => {
      await request(app.getHttpServer())
        .get(`/orgs/10/analytics/cost-over-time?from=${validTo}&to=${validFrom}`)
        .expect(400);
    });

    it('should return 400 when date range exceeds 365 days', async () => {
      const farFuture = '2028-01-01T00:00:00.000Z';
      await request(app.getHttpServer())
        .get(`/orgs/10/analytics/cost-over-time?from=${validFrom}&to=${farFuture}`)
        .expect(400);
    });

    it('should return 400 for invalid date format', async () => {
      await request(app.getHttpServer())
        .get('/orgs/10/analytics/cost-over-time?from=not-a-date&to=also-not-a-date')
        .expect(400);
    });

    it('should return 400 for non-numeric orgId', async () => {
      await request(app.getHttpServer())
        .get(`/orgs/abc/analytics/cost-over-time?from=${validFrom}&to=${validTo}`)
        .expect(400);
    });

    it('should return summary with averageCostMicros', async () => {
      analyticsService.getCostAnalytics.mockResolvedValue(
        makeAnalyticsData({
          summary: {
            totalCostMicros: 1000000,
            totalInputTokens: 5000,
            totalOutputTokens: 2000,
            executionsWithCost: 4,
            averageCostMicros: 250000,
          },
        }),
      );

      const response = await request(app.getHttpServer())
        .get(`/orgs/10/analytics/cost-over-time?from=${validFrom}&to=${validTo}`)
        .expect(200);

      expect(response.body.data.summary.totalCostMicros).toBe(1000000);
      expect(response.body.data.summary.averageCostMicros).toBe(250000);
    });
  });
});
