import { Test, type TestingModule } from '@nestjs/testing';
import {
  type INestApplication,
  type CanActivate,
  type ExecutionContext,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import request from 'supertest';
import type { Request } from 'express';
import { AutomationsController } from '../automations.controller';
import { AutomationService } from '../automations.service';
import { OrgGuard } from '../../../common/guards/org.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { TransformInterceptor } from '../../../common/interceptors/transform.interceptor';

function createMockAutomationService() {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined),
    setEnabled: vi.fn().mockResolvedValue(undefined),
    triggerManual: vi.fn(),
    validatePrompt: vi.fn(),
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

function makeAutomation(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    orgId: 10,
    repoId: 100,
    name: 'test-automation',
    description: null,
    triggerType: 'event',
    triggerConfig: { events: ['pull_request.opened'] },
    promptTemplate: 'Review {{pr.title}}',
    workflowFile: '.github/workflows/codaholiq.yml',
    enabled: true,
    createdBy: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    variables: [],
    ...overrides,
  };
}

describe('AutomationsController', () => {
  let app: INestApplication;
  let automationService: ReturnType<typeof createMockAutomationService>;

  beforeAll(async () => {
    automationService = createMockAutomationService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AutomationsController],
      providers: [
        {
          provide: AutomationService,
          useValue: automationService,
        },
      ],
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

  describe('POST /orgs/:orgId/automations', () => {
    const validBody = {
      name: 'test-automation',
      repoId: 100,
      triggerType: 'event',
      triggerConfig: { events: ['pull_request.opened'] },
      promptTemplate: 'Review {{pr.title}}',
      provider: 'claude-code',
    };

    it('should create automation and return 201', async () => {
      automationService.create.mockResolvedValue(makeAutomation());

      const response = await request(app.getHttpServer())
        .post('/orgs/10/automations')
        .send(validBody)
        .expect(201);

      expect(response.body.data).toMatchObject({ name: 'test-automation' });
      expect(automationService.create).toHaveBeenCalledWith(expect.objectContaining({ orgId: 10 }));
    });

    it('should return 400 for invalid body', async () => {
      await request(app.getHttpServer())
        .post('/orgs/10/automations')
        .send({ name: '' })
        .expect(400);
    });
  });

  describe('GET /orgs/:orgId/automations', () => {
    it('should return list of automations', async () => {
      automationService.list.mockResolvedValue([makeAutomation()]);

      const response = await request(app.getHttpServer()).get('/orgs/10/automations').expect(200);

      expect(response.body.data).toHaveLength(1);
    });

    it('should pass query filters', async () => {
      automationService.list.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/orgs/10/automations?triggerType=cron&enabled=true&limit=5')
        .expect(200);

      expect(automationService.list).toHaveBeenCalledWith({
        orgId: 10,
        filters: expect.objectContaining({
          triggerType: 'cron',
          enabled: true,
          limit: 5,
        }),
      });
    });

    it('should return 400 for invalid triggerType', async () => {
      await request(app.getHttpServer())
        .get('/orgs/10/automations?triggerType=invalid')
        .expect(400);
    });

    it('should return 400 for non-numeric limit', async () => {
      await request(app.getHttpServer()).get('/orgs/10/automations?limit=abc').expect(400);
    });
  });

  describe('GET /orgs/:orgId/automations/:automationId', () => {
    it('should return automation by ID', async () => {
      automationService.findById.mockResolvedValue(makeAutomation());

      const response = await request(app.getHttpServer()).get('/orgs/10/automations/1').expect(200);

      expect(response.body.data.name).toBe('test-automation');
    });

    it('should return 404 when not found', async () => {
      automationService.findById.mockRejectedValue(new NotFoundException('Automation not found'));

      await request(app.getHttpServer()).get('/orgs/10/automations/999').expect(404);
    });
  });

  describe('PATCH /orgs/:orgId/automations/:automationId', () => {
    it('should update and return automation', async () => {
      automationService.update.mockResolvedValue(makeAutomation({ name: 'updated' }));

      const response = await request(app.getHttpServer())
        .patch('/orgs/10/automations/1')
        .send({ name: 'updated' })
        .expect(200);

      expect(response.body.data.name).toBe('updated');
    });
  });

  describe('DELETE /orgs/:orgId/automations/:automationId', () => {
    it('should return 204', async () => {
      await request(app.getHttpServer()).delete('/orgs/10/automations/1').expect(204);

      expect(automationService.delete).toHaveBeenCalledWith({
        orgId: 10,
        automationId: 1,
      });
    });
  });

  describe('PATCH /orgs/:orgId/automations/:automationId/enabled', () => {
    it('should toggle enabled and return 204', async () => {
      await request(app.getHttpServer())
        .patch('/orgs/10/automations/1/enabled')
        .send({ enabled: false })
        .expect(204);

      expect(automationService.setEnabled).toHaveBeenCalledWith({
        orgId: 10,
        automationId: 1,
        enabled: false,
      });
    });

    it('should return 400 for non-boolean enabled value', async () => {
      await request(app.getHttpServer())
        .patch('/orgs/10/automations/1/enabled')
        .send({ enabled: 'not-a-boolean' })
        .expect(400);
    });

    it('should return 400 when enabled field is missing', async () => {
      await request(app.getHttpServer())
        .patch('/orgs/10/automations/1/enabled')
        .send({})
        .expect(400);
    });
  });

  describe('POST /orgs/:orgId/automations/:automationId/trigger', () => {
    it('should create execution and return 201', async () => {
      automationService.triggerManual.mockResolvedValue({
        id: 42,
        status: 'pending',
      });

      const response = await request(app.getHttpServer())
        .post('/orgs/10/automations/1/trigger')
        .send({})
        .expect(201);

      expect(response.body.data).toEqual({
        executionId: 42,
        status: 'pending',
      });
    });

    it('should pass variable overrides', async () => {
      automationService.triggerManual.mockResolvedValue({
        id: 42,
        status: 'pending',
      });

      await request(app.getHttpServer())
        .post('/orgs/10/automations/1/trigger')
        .send({ variables: { branch: 'feature-x' } })
        .expect(201);

      expect(automationService.triggerManual).toHaveBeenCalledWith(
        expect.objectContaining({
          variableOverrides: { branch: 'feature-x' },
        }),
      );
    });

    it('should return 400 for disabled automation', async () => {
      automationService.triggerManual.mockRejectedValue(
        new BadRequestException('Automation is disabled'),
      );

      await request(app.getHttpServer())
        .post('/orgs/10/automations/1/trigger')
        .send({})
        .expect(400);
    });
  });

  describe('POST /orgs/:orgId/automations/:automationId/validate-prompt', () => {
    it('should validate prompt and return resolved template', async () => {
      automationService.validatePrompt.mockResolvedValue({
        resolvedPrompt: 'Review the PR',
        variables: ['pr.title'],
      });

      const response = await request(app.getHttpServer())
        .post('/orgs/10/automations/1/validate-prompt')
        .send({ promptTemplate: 'Review {{pr.title}}' })
        .expect(200);

      expect(response.body.data.resolvedPrompt).toBe('Review the PR');
      expect(response.body.data.variables).toEqual(['pr.title']);
    });

    it('should pass sample variables to service', async () => {
      automationService.validatePrompt.mockResolvedValue({
        resolvedPrompt: 'Review fix-bug',
        variables: ['branch'],
      });

      await request(app.getHttpServer())
        .post('/orgs/10/automations/1/validate-prompt')
        .send({
          promptTemplate: 'Review {{branch}}',
          sampleVariables: { branch: 'fix-bug' },
        })
        .expect(200);

      expect(automationService.validatePrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          dto: expect.objectContaining({
            sampleVariables: { branch: 'fix-bug' },
          }),
        }),
      );
    });

    it('should return 400 for empty prompt template', async () => {
      await request(app.getHttpServer())
        .post('/orgs/10/automations/1/validate-prompt')
        .send({ promptTemplate: '' })
        .expect(400);
    });

    it('should return 400 for missing prompt template', async () => {
      await request(app.getHttpServer())
        .post('/orgs/10/automations/1/validate-prompt')
        .send({})
        .expect(400);
    });
  });
});
