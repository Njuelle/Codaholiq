import { Test, type TestingModule } from '@nestjs/testing';
import {
  type INestApplication,
  type CanActivate,
  type ExecutionContext,
  NotFoundException,
} from '@nestjs/common';
import request from 'supertest';
import type { Request } from 'express';
import { ExecutionsController } from '../executions.controller';
import { ExecutionsService } from '../executions.service';
import { OrgGuard } from '../../../common/guards/org.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { TransformInterceptor } from '../../../common/interceptors/transform.interceptor';

function createMockExecutionsService() {
  return {
    list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findById: vi.fn(),
    findLogs: vi.fn().mockResolvedValue([]),
    cancel: vi.fn().mockResolvedValue(undefined),
    retry: vi.fn(),
    getStats: vi.fn().mockResolvedValue({ byStatus: [] }),
    streamLogs: vi.fn(),
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

function makeExecution(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    automationId: 100,
    status: 'completed',
    triggerEvent: null,
    resolvedPrompt: 'Test prompt',
    githubRunId: null,
    githubRunUrl: null,
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeLog(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    executionId: 1,
    level: 'info',
    message: 'Test log',
    metadata: null,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('ExecutionsController', () => {
  let app: INestApplication;
  let executionsService: ReturnType<typeof createMockExecutionsService>;

  beforeAll(async () => {
    executionsService = createMockExecutionsService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ExecutionsController],
      providers: [{ provide: ExecutionsService, useValue: executionsService }],
    })
      .overrideGuard(OrgGuard)
      .useValue(mockOrgGuard)
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
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

  describe('GET /orgs/:orgId/executions', () => {
    it('should return list of executions with pagination meta', async () => {
      executionsService.list.mockResolvedValue({
        items: [{ execution: makeExecution(), automationName: 'test-auto' }],
        total: 1,
      });

      const response = await request(app.getHttpServer()).get('/orgs/10/executions').expect(200);

      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.meta).toEqual({
        total: 1,
        limit: 50,
        offset: 0,
      });
    });

    it('should pass query filters', async () => {
      executionsService.list.mockResolvedValue({ items: [], total: 0 });

      await request(app.getHttpServer())
        .get('/orgs/10/executions?status=failed&automationId=5&limit=10')
        .expect(200);

      expect(executionsService.list).toHaveBeenCalledWith({
        orgId: 10,
        filters: expect.objectContaining({
          status: 'failed',
          automationId: 5,
          limit: 10,
        }),
      });
    });

    it('should return 400 for invalid status', async () => {
      await request(app.getHttpServer()).get('/orgs/10/executions?status=invalid').expect(400);
    });
  });

  describe('GET /orgs/:orgId/executions/stats', () => {
    it('should return execution stats', async () => {
      executionsService.getStats.mockResolvedValue({
        byStatus: [
          { status: 'completed', count: 10 },
          { status: 'failed', count: 2 },
        ],
      });

      const response = await request(app.getHttpServer())
        .get('/orgs/10/executions/stats')
        .expect(200);

      expect(response.body.data.byStatus).toHaveLength(2);
    });
  });

  describe('GET /orgs/:orgId/executions/:executionId', () => {
    it('should return execution detail', async () => {
      executionsService.findById.mockResolvedValue({
        execution: makeExecution(),
        automationName: 'test-auto',
      });

      const response = await request(app.getHttpServer()).get('/orgs/10/executions/1').expect(200);

      expect(response.body.data.execution.id).toBe(1);
      expect(response.body.data.automationName).toBe('test-auto');
    });

    it('should return 404 for non-existent execution', async () => {
      executionsService.findById.mockRejectedValue(new NotFoundException('Execution not found'));

      await request(app.getHttpServer()).get('/orgs/10/executions/999').expect(404);
    });
  });

  describe('GET /orgs/:orgId/executions/:executionId/logs', () => {
    it('should return execution logs', async () => {
      executionsService.findLogs.mockResolvedValue([makeLog()]);

      const response = await request(app.getHttpServer())
        .get('/orgs/10/executions/1/logs')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].message).toBe('Test log');
    });

    it('should pass after and limit query params', async () => {
      executionsService.findLogs.mockResolvedValue([]);
      const afterDate = '2026-01-01T00:00:00.000Z';

      await request(app.getHttpServer())
        .get(`/orgs/10/executions/1/logs?after=${afterDate}&limit=100`)
        .expect(200);

      expect(executionsService.findLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          after: afterDate,
          limit: 100,
        }),
      );
    });
  });

  describe('POST /orgs/:orgId/executions/:executionId/cancel', () => {
    it('should cancel execution and return 204', async () => {
      await request(app.getHttpServer()).post('/orgs/10/executions/1/cancel').expect(204);

      expect(executionsService.cancel).toHaveBeenCalledWith({
        orgId: 10,
        executionId: 1,
      });
    });

    it('should return 404 for non-existent execution', async () => {
      executionsService.cancel.mockRejectedValue(new NotFoundException('Execution not found'));

      await request(app.getHttpServer()).post('/orgs/10/executions/999/cancel').expect(404);
    });
  });

  describe('POST /orgs/:orgId/executions/:executionId/retry', () => {
    it('should retry and return new execution', async () => {
      executionsService.retry.mockResolvedValue(makeExecution({ id: 2, status: 'pending' }));

      const response = await request(app.getHttpServer())
        .post('/orgs/10/executions/1/retry')
        .expect(201);

      expect(response.body.data.id).toBe(2);
      expect(response.body.data.status).toBe('pending');
    });

    it('should return 404 for non-existent execution', async () => {
      executionsService.retry.mockRejectedValue(new NotFoundException('Execution not found'));

      await request(app.getHttpServer()).post('/orgs/10/executions/999/retry').expect(404);
    });
  });
});
