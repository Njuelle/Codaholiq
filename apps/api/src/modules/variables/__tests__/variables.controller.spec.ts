import { Test, type TestingModule } from '@nestjs/testing';
import {
  type INestApplication,
  type CanActivate,
  type ExecutionContext,
  NotFoundException,
} from '@nestjs/common';
import request from 'supertest';
import type { Request } from 'express';
import { VariablesController } from '../variables.controller';
import { VariablesService } from '../variables.service';
import { OrgGuard } from '../../../common/guards/org.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { TransformInterceptor } from '../../../common/interceptors/transform.interceptor';

function createMockVariablesService() {
  return {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined),
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

const mockVariable = {
  id: 1,
  orgId: 10,
  repoId: null,
  key: 'api_key',
  value: 'test-value',
  description: 'A test variable',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

describe('VariablesController', () => {
  let app: INestApplication;
  let variablesService: ReturnType<typeof createMockVariablesService>;

  beforeAll(async () => {
    variablesService = createMockVariablesService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [VariablesController],
      providers: [{ provide: VariablesService, useValue: variablesService }],
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

  describe('GET /orgs/:orgId/variables', () => {
    it('should return list of variables', async () => {
      variablesService.list.mockResolvedValue([mockVariable]);

      const response = await request(app.getHttpServer()).get('/orgs/10/variables').expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        id: 1,
        key: 'api_key',
        value: 'test-value',
      });
    });

    it('should call service.list with orgId', async () => {
      variablesService.list.mockResolvedValue([]);

      await request(app.getHttpServer()).get('/orgs/10/variables').expect(200);

      expect(variablesService.list).toHaveBeenCalledWith({ orgId: 10 });
    });
  });

  describe('POST /orgs/:orgId/variables', () => {
    const validBody = {
      key: 'api_key',
      value: 'test-value',
      description: 'A test variable',
    };

    it('should create variable and return 201', async () => {
      variablesService.create.mockResolvedValue(mockVariable);

      const response = await request(app.getHttpServer())
        .post('/orgs/10/variables')
        .send(validBody)
        .expect(201);

      expect(response.body.data).toMatchObject({
        id: 1,
        key: 'api_key',
        value: 'test-value',
      });
      expect(variablesService.create).toHaveBeenCalledWith({
        orgId: 10,
        dto: validBody,
      });
    });

    it('should reject invalid key format', async () => {
      await request(app.getHttpServer())
        .post('/orgs/10/variables')
        .send({ key: 'invalid key!', value: 'test-value' })
        .expect(400);
    });

    it('should reject missing key', async () => {
      await request(app.getHttpServer())
        .post('/orgs/10/variables')
        .send({ value: 'test-value' })
        .expect(400);
    });

    it('should reject missing value', async () => {
      await request(app.getHttpServer())
        .post('/orgs/10/variables')
        .send({ key: 'valid_key' })
        .expect(400);
    });

    it('should reject empty key', async () => {
      await request(app.getHttpServer())
        .post('/orgs/10/variables')
        .send({ key: '', value: 'test-value' })
        .expect(400);
    });

    it('should reject empty value', async () => {
      await request(app.getHttpServer())
        .post('/orgs/10/variables')
        .send({ key: 'valid_key', value: '' })
        .expect(400);
    });

    it('should accept key with dots and underscores', async () => {
      variablesService.create.mockResolvedValue({
        ...mockVariable,
        key: 'my.config_key',
      });

      await request(app.getHttpServer())
        .post('/orgs/10/variables')
        .send({ key: 'my.config_key', value: 'some-value' })
        .expect(201);
    });

    it('should accept optional repoId', async () => {
      variablesService.create.mockResolvedValue({
        ...mockVariable,
        repoId: 5,
      });

      const response = await request(app.getHttpServer())
        .post('/orgs/10/variables')
        .send({ key: 'repo_key', value: 'repo-value', repoId: 5 })
        .expect(201);

      expect(response.body.data.repoId).toBe(5);
      expect(variablesService.create).toHaveBeenCalledWith({
        orgId: 10,
        dto: { key: 'repo_key', value: 'repo-value', repoId: 5 },
      });
    });
  });

  describe('PATCH /orgs/:orgId/variables/:variableId', () => {
    it('should update variable and return 200', async () => {
      const updatedVariable = { ...mockVariable, value: 'updated-value' };
      variablesService.update.mockResolvedValue(updatedVariable);

      const response = await request(app.getHttpServer())
        .patch('/orgs/10/variables/1')
        .send({ value: 'updated-value' })
        .expect(200);

      expect(response.body.data.value).toBe('updated-value');
      expect(variablesService.update).toHaveBeenCalledWith({
        orgId: 10,
        variableId: 1,
        dto: { value: 'updated-value' },
      });
    });

    it('should update description', async () => {
      const updatedVariable = { ...mockVariable, description: 'New description' };
      variablesService.update.mockResolvedValue(updatedVariable);

      const response = await request(app.getHttpServer())
        .patch('/orgs/10/variables/1')
        .send({ description: 'New description' })
        .expect(200);

      expect(response.body.data.description).toBe('New description');
    });

    it('should allow setting description to null', async () => {
      const updatedVariable = { ...mockVariable, description: null };
      variablesService.update.mockResolvedValue(updatedVariable);

      const response = await request(app.getHttpServer())
        .patch('/orgs/10/variables/1')
        .send({ description: null })
        .expect(200);

      expect(response.body.data.description).toBeNull();
    });

    it('should reject empty body', async () => {
      await request(app.getHttpServer()).patch('/orgs/10/variables/1').send({}).expect(400);
    });

    it('should return 404 when variable not found', async () => {
      variablesService.update.mockRejectedValue(new NotFoundException('Variable not found'));

      await request(app.getHttpServer())
        .patch('/orgs/10/variables/999')
        .send({ value: 'updated-value' })
        .expect(404);
    });
  });

  describe('DELETE /orgs/:orgId/variables/:variableId', () => {
    it('should delete variable and return 204', async () => {
      await request(app.getHttpServer()).delete('/orgs/10/variables/1').expect(204);

      expect(variablesService.delete).toHaveBeenCalledWith({
        orgId: 10,
        variableId: 1,
      });
    });

    it('should return 404 when variable not found', async () => {
      variablesService.delete.mockRejectedValue(new NotFoundException('Variable not found'));

      await request(app.getHttpServer()).delete('/orgs/10/variables/999').expect(404);
    });
  });
});
