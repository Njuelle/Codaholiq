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
import { RepositoriesController } from '../repositories.controller';
import { RepositoriesService } from '../repositories.service';
import { OrgGuard } from '../../../common/guards/org.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { TransformInterceptor } from '../../../common/interceptors/transform.interceptor';

function createMockRepoService() {
  return {
    list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findById: vi.fn(),
    getSetupStatus: vi.fn(),
    triggerSync: vi.fn(),
    updateWebhookActive: vi.fn(),
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

const mockPermissionGuard: CanActivate = { canActivate: () => true };

function makeRepo(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    githubId: 300001,
    installationId: 1,
    orgId: 10,
    owner: 'test-owner',
    name: 'test-repo',
    fullName: 'test-owner/test-repo',
    defaultBranch: 'main',
    private: false,
    language: 'TypeScript',
    archived: false,
    webhookActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('RepositoriesController', () => {
  let app: INestApplication;
  let repoService: ReturnType<typeof createMockRepoService>;

  beforeAll(async () => {
    repoService = createMockRepoService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [RepositoriesController],
      providers: [{ provide: RepositoriesService, useValue: repoService }],
    })
      .overrideGuard(OrgGuard)
      .useValue(mockOrgGuard)
      .overrideGuard(PermissionGuard)
      .useValue(mockPermissionGuard)
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

  describe('GET /orgs/:orgId/repos', () => {
    it('should return list of repos with pagination meta', async () => {
      repoService.list.mockResolvedValue({
        items: [makeRepo()],
        total: 1,
      });

      const response = await request(app.getHttpServer()).get('/orgs/10/repos').expect(200);

      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.meta).toEqual({
        total: 1,
        limit: 50,
        offset: 0,
      });
    });

    it('should pass search and filter params to service', async () => {
      repoService.list.mockResolvedValue({ items: [], total: 0 });

      await request(app.getHttpServer())
        .get('/orgs/10/repos?search=test&language=TypeScript&archived=false&limit=10&offset=5')
        .expect(200);

      expect(repoService.list).toHaveBeenCalledWith({
        orgId: 10,
        filters: expect.objectContaining({
          search: 'test',
          language: 'TypeScript',
          archived: false,
          limit: 10,
          offset: 5,
        }),
      });
    });

    it('should return empty list', async () => {
      repoService.list.mockResolvedValue({ items: [], total: 0 });

      const response = await request(app.getHttpServer()).get('/orgs/10/repos').expect(200);

      expect(response.body.data.items).toEqual([]);
      expect(response.body.data.meta.total).toBe(0);
    });
  });

  describe('GET /orgs/:orgId/repos/:repoId', () => {
    it('should return repo detail with automation count', async () => {
      repoService.findById.mockResolvedValue({
        repo: makeRepo(),
        automationCount: 3,
      });

      const response = await request(app.getHttpServer()).get('/orgs/10/repos/1').expect(200);

      expect(response.body.data.repo.name).toBe('test-repo');
      expect(response.body.data.automationCount).toBe(3);
    });

    it('should return 404 for non-existent repo', async () => {
      repoService.findById.mockRejectedValue(new NotFoundException('Repository not found'));

      await request(app.getHttpServer()).get('/orgs/10/repos/999').expect(404);
    });
  });

  describe('GET /orgs/:orgId/repos/:repoId/setup-status', () => {
    it('should return setup status', async () => {
      repoService.getSetupStatus.mockResolvedValue({ workflowFileExists: true });

      const response = await request(app.getHttpServer())
        .get('/orgs/10/repos/1/setup-status')
        .expect(200);

      expect(response.body.data.workflowFileExists).toBe(true);
    });

    it('should return 404 for non-existent repo', async () => {
      repoService.getSetupStatus.mockRejectedValue(new NotFoundException('Repository not found'));

      await request(app.getHttpServer()).get('/orgs/10/repos/999/setup-status').expect(404);
    });
  });

  describe('POST /orgs/:orgId/repos/sync', () => {
    it('should trigger sync and return count', async () => {
      repoService.triggerSync.mockResolvedValue({ synced: 5 });

      const response = await request(app.getHttpServer()).post('/orgs/10/repos/sync').expect(200);

      expect(response.body.data.synced).toBe(5);
    });

    it('should return 400 if no installation found', async () => {
      repoService.triggerSync.mockRejectedValue(
        new BadRequestException('No GitHub App installation found for this organization'),
      );

      await request(app.getHttpServer()).post('/orgs/10/repos/sync').expect(400);
    });
  });

  describe('PATCH /orgs/:orgId/repos/:repoId', () => {
    it('should update webhook active status', async () => {
      repoService.updateWebhookActive.mockResolvedValue(makeRepo({ webhookActive: false }));

      const response = await request(app.getHttpServer())
        .patch('/orgs/10/repos/1')
        .send({ webhookActive: false })
        .expect(200);

      expect(response.body.data.webhookActive).toBe(false);
    });

    it('should return 400 for invalid body', async () => {
      await request(app.getHttpServer())
        .patch('/orgs/10/repos/1')
        .send({ webhookActive: 'not-a-boolean' })
        .expect(400);
    });

    it('should return 404 for non-existent repo', async () => {
      repoService.updateWebhookActive.mockRejectedValue(
        new NotFoundException('Repository not found'),
      );

      await request(app.getHttpServer())
        .patch('/orgs/10/repos/999')
        .send({ webhookActive: true })
        .expect(404);
    });
  });
});
