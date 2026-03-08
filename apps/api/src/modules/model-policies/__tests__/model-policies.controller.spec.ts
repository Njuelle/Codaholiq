import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication, type CanActivate, type ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import type { Request } from 'express';
import { ModelPoliciesController } from '../model-policies.controller';
import { ModelPoliciesService } from '../model-policies.service';
import { OrgGuard } from '../../../common/guards/org.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { TransformInterceptor } from '../../../common/interceptors/transform.interceptor';

function createMockService() {
  return {
    getForRepo: vi.fn(),
    setForRepo: vi.fn(),
    validateModelAllowed: vi.fn(),
  };
}

const mockOrgGuard: CanActivate = {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    req.user = { sub: 1, username: 'testuser', avatarUrl: null, iat: 0, exp: 0 };
    req.orgMember = { orgId: Number(req.params.orgId), userId: 1, role: 'admin' };
    return true;
  },
};

const mockPoliciesResult = {
  policies: [
    {
      id: 1,
      orgId: 10,
      repoId: 100,
      provider: 'claude-code',
      model: 'claude-sonnet-4-5-20250929',
      createdAt: '2025-01-01T00:00:00.000Z',
      createdBy: 1,
    },
  ],
  isRestricted: true,
};

describe('ModelPoliciesController', () => {
  let app: INestApplication;
  let service: ReturnType<typeof createMockService>;

  beforeAll(async () => {
    service = createMockService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ModelPoliciesController],
      providers: [{ provide: ModelPoliciesService, useValue: service }],
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

  describe('GET /orgs/:orgId/repos/:repoId/model-policies', () => {
    it('should return model policies for a repo', async () => {
      service.getForRepo.mockResolvedValue(mockPoliciesResult);

      const response = await request(app.getHttpServer())
        .get('/orgs/10/repos/100/model-policies')
        .expect(200);

      expect(response.body.data).toMatchObject({
        isRestricted: true,
        policies: expect.arrayContaining([
          expect.objectContaining({
            provider: 'claude-code',
            model: 'claude-sonnet-4-5-20250929',
          }),
        ]),
      });
    });

    it('should call service with correct params', async () => {
      service.getForRepo.mockResolvedValue({ policies: [], isRestricted: false });

      await request(app.getHttpServer()).get('/orgs/10/repos/100/model-policies').expect(200);

      expect(service.getForRepo).toHaveBeenCalledWith({ orgId: 10, repoId: 100 });
    });
  });

  describe('PUT /orgs/:orgId/repos/:repoId/model-policies', () => {
    it('should set model policies', async () => {
      service.setForRepo.mockResolvedValue(mockPoliciesResult);

      const response = await request(app.getHttpServer())
        .put('/orgs/10/repos/100/model-policies')
        .send({
          policies: [{ provider: 'claude-code', model: 'claude-sonnet-4-5-20250929' }],
        })
        .expect(200);

      expect(response.body.data.isRestricted).toBe(true);
    });

    it('should call service with dto and userId', async () => {
      service.setForRepo.mockResolvedValue({ policies: [], isRestricted: false });

      await request(app.getHttpServer())
        .put('/orgs/10/repos/100/model-policies')
        .send({ policies: [] })
        .expect(200);

      expect(service.setForRepo).toHaveBeenCalledWith({
        orgId: 10,
        repoId: 100,
        dto: { policies: [] },
        userId: 1,
      });
    });

    it('should reject invalid body', async () => {
      await request(app.getHttpServer())
        .put('/orgs/10/repos/100/model-policies')
        .send({ policies: [{ provider: '' }] })
        .expect(400);
    });
  });
});
