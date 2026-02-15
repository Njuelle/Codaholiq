import { Test, type TestingModule } from '@nestjs/testing';
import {
  type INestApplication,
  type CanActivate,
  type ExecutionContext,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import request from 'supertest';
import type { Request } from 'express';
import { OrganizationsController } from '../organizations.controller';
import { OrganizationsService } from '../organizations.service';
import { OrgGuard } from '../../../common/guards/org.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { TransformInterceptor } from '../../../common/interceptors/transform.interceptor';

function createMockOrgService() {
  return {
    listOrgsForUser: vi.fn().mockResolvedValue([]),
    findOrgById: vi.fn(),
    listMembers: vi.fn().mockResolvedValue([]),
    inviteMember: vi.fn(),
    updateMemberRole: vi.fn().mockResolvedValue(undefined),
    removeMember: vi.fn().mockResolvedValue(undefined),
  };
}

function makeMockOrgGuard(role: 'owner' | 'admin' | 'member' = 'member'): CanActivate {
  return {
    canActivate(context: ExecutionContext) {
      const req = context.switchToHttp().getRequest<Request>();
      req.user = { sub: 1, username: 'testuser', avatarUrl: null, iat: 0, exp: 0 };
      req.orgMember = { orgId: Number(req.params.orgId), userId: 1, role };
      return true;
    },
  };
}

const mockPermissionGuard: CanActivate = { canActivate: () => true };

function makeOrg(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    name: 'Test Org',
    slug: 'test-org',
    avatarUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeMember(overrides: Record<string, unknown> = {}) {
  return {
    userId: 2,
    role: 'member',
    joinedAt: new Date().toISOString(),
    username: 'memberuser',
    avatarUrl: null,
    ...overrides,
  };
}

describe('OrganizationsController', () => {
  let app: INestApplication;
  let orgService: ReturnType<typeof createMockOrgService>;

  beforeAll(async () => {
    orgService = createMockOrgService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [{ provide: OrganizationsService, useValue: orgService }],
    })
      .overrideGuard(OrgGuard)
      .useValue(makeMockOrgGuard())
      .overrideGuard(PermissionGuard)
      .useValue(mockPermissionGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    // Set req.user for all routes (JWT guard is not loaded in test module)
    app.use((req: Request, _res: unknown, next: () => void) => {
      req.user = { sub: 1, username: 'testuser', avatarUrl: null, iat: 0, exp: 0 };
      next();
    });
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /orgs', () => {
    it('should return list of orgs for current user', async () => {
      orgService.listOrgsForUser.mockResolvedValue([makeOrg()]);

      const response = await request(app.getHttpServer()).get('/orgs').expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Test Org');
      expect(response.body.requestId).toBeDefined();
    });

    it('should return empty array when user has no orgs', async () => {
      orgService.listOrgsForUser.mockResolvedValue([]);

      const response = await request(app.getHttpServer()).get('/orgs').expect(200);

      expect(response.body.data).toEqual([]);
    });
  });

  describe('GET /orgs/:orgId', () => {
    it('should return org details with member count', async () => {
      orgService.findOrgById.mockResolvedValue({
        org: makeOrg(),
        memberCount: 5,
      });

      const response = await request(app.getHttpServer()).get('/orgs/10').expect(200);

      expect(response.body.data.org.name).toBe('Test Org');
      expect(response.body.data.memberCount).toBe(5);
    });

    it('should return 404 for non-existent org', async () => {
      orgService.findOrgById.mockRejectedValue(new NotFoundException('Organization not found'));

      await request(app.getHttpServer()).get('/orgs/999').expect(404);
    });
  });

  describe('GET /orgs/:orgId/members', () => {
    it('should return list of members', async () => {
      orgService.listMembers.mockResolvedValue([makeMember()]);

      const response = await request(app.getHttpServer()).get('/orgs/10/members').expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].username).toBe('memberuser');
    });
  });

  describe('POST /orgs/:orgId/members', () => {
    it('should invite a member and return 201', async () => {
      orgService.inviteMember.mockResolvedValue({
        orgId: 10,
        userId: 2,
        role: 'member',
        joinedAt: new Date().toISOString(),
      });

      const response = await request(app.getHttpServer())
        .post('/orgs/10/members')
        .send({ username: 'newuser' })
        .expect(201);

      expect(response.body.data.userId).toBe(2);
    });

    it('should return 404 for non-existent user', async () => {
      orgService.inviteMember.mockRejectedValue(new NotFoundException('User not found'));

      await request(app.getHttpServer())
        .post('/orgs/10/members')
        .send({ username: 'nonexistent' })
        .expect(404);
    });

    it('should return 409 for already-member user', async () => {
      orgService.inviteMember.mockRejectedValue(new ConflictException('User is already a member'));

      await request(app.getHttpServer())
        .post('/orgs/10/members')
        .send({ username: 'existinguser' })
        .expect(409);
    });

    it('should return 400 for missing username', async () => {
      await request(app.getHttpServer()).post('/orgs/10/members').send({}).expect(400);
    });
  });

  describe('PATCH /orgs/:orgId/members/:userId', () => {
    it('should update member role and return 204', async () => {
      await request(app.getHttpServer())
        .patch('/orgs/10/members/2')
        .send({ role: 'admin' })
        .expect(204);

      expect(orgService.updateMemberRole).toHaveBeenCalledWith({
        orgId: 10,
        userId: 2,
        dto: { role: 'admin' },
      });
    });

    it('should return 400 for invalid role', async () => {
      await request(app.getHttpServer())
        .patch('/orgs/10/members/2')
        .send({ role: 'superadmin' })
        .expect(400);
    });

    it('should return 400 when trying to demote last owner', async () => {
      orgService.updateMemberRole.mockRejectedValue(
        new BadRequestException('Cannot demote the last owner'),
      );

      await request(app.getHttpServer())
        .patch('/orgs/10/members/1')
        .send({ role: 'member' })
        .expect(400);
    });
  });

  describe('DELETE /orgs/:orgId/members/:userId', () => {
    it('should remove member and return 204', async () => {
      await request(app.getHttpServer()).delete('/orgs/10/members/2').expect(204);

      expect(orgService.removeMember).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 10,
          targetUserId: 2,
          requestingUserId: 1,
        }),
      );
    });

    it('should allow self-leave', async () => {
      await request(app.getHttpServer()).delete('/orgs/10/members/1').expect(204);

      expect(orgService.removeMember).toHaveBeenCalledWith(
        expect.objectContaining({
          targetUserId: 1,
          requestingUserId: 1,
        }),
      );
    });

    it('should return 404 for non-member', async () => {
      orgService.removeMember.mockRejectedValue(new NotFoundException('Member not found'));

      await request(app.getHttpServer()).delete('/orgs/10/members/999').expect(404);
    });

    it('should return 400 when removing last owner', async () => {
      orgService.removeMember.mockRejectedValue(
        new BadRequestException('Cannot remove the last owner'),
      );

      await request(app.getHttpServer()).delete('/orgs/10/members/1').expect(400);
    });
  });
});
