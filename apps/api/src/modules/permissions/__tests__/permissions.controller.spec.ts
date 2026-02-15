import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PermissionsController } from '../permissions.controller';
import { PermissionsService } from '../permissions.service';
import { OrgGuard } from '../../../common/guards/org.guard';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { Permission, ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from '../permissions.constants';

const mockPermissionsService = {
  getMyPermissions: vi.fn(),
  getAllRolePermissions: vi.fn(),
  updateRolePermissions: vi.fn(),
};

function createMockOrgGuard(role: 'owner' | 'admin' | 'member') {
  return {
    canActivate: vi.fn().mockImplementation((context) => {
      const req = context.switchToHttp().getRequest();
      req.user = { sub: 1, username: 'testuser' };
      req.orgMember = { orgId: 1, userId: 1, role };
      return true;
    }),
  };
}

describe('PermissionsController', () => {
  let app: INestApplication;
  let mockOrgGuard: ReturnType<typeof createMockOrgGuard>;

  beforeAll(async () => {
    mockOrgGuard = createMockOrgGuard('owner');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PermissionsController],
      providers: [
        {
          provide: PermissionsService,
          useValue: mockPermissionsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrgGuard)
      .useValue(mockOrgGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockOrgGuard.canActivate.mockImplementation((context) => {
      const req = context.switchToHttp().getRequest();
      req.user = { sub: 1, username: 'testuser' };
      req.orgMember = { orgId: 1, userId: 1, role: 'owner' };
      return true;
    });
  });

  describe('GET /orgs/:orgId/permissions/me', () => {
    it('should return current user permissions', async () => {
      const mockResponse = {
        role: 'admin',
        permissions: DEFAULT_ROLE_PERMISSIONS.admin,
      };
      mockPermissionsService.getMyPermissions.mockResolvedValue(mockResponse);

      const response = await request(app.getHttpServer()).get('/orgs/1/permissions/me').expect(200);

      expect(response.body.role).toBe('admin');
      expect(response.body.permissions).toEqual([...DEFAULT_ROLE_PERMISSIONS.admin]);
    });

    it('should work for any org member role', async () => {
      mockOrgGuard.canActivate.mockImplementation((context) => {
        const req = context.switchToHttp().getRequest();
        req.user = { sub: 2, username: 'member' };
        req.orgMember = { orgId: 1, userId: 2, role: 'member' };
        return true;
      });

      mockPermissionsService.getMyPermissions.mockResolvedValue({
        role: 'member',
        permissions: DEFAULT_ROLE_PERMISSIONS.member,
      });

      const response = await request(app.getHttpServer()).get('/orgs/1/permissions/me').expect(200);

      expect(response.body.role).toBe('member');
    });
  });

  describe('GET /orgs/:orgId/permissions', () => {
    it('should return all role permissions for owner', async () => {
      mockPermissionsService.getAllRolePermissions.mockResolvedValue({
        owner: ALL_PERMISSIONS,
        admin: DEFAULT_ROLE_PERMISSIONS.admin,
        member: DEFAULT_ROLE_PERMISSIONS.member,
      });

      const response = await request(app.getHttpServer()).get('/orgs/1/permissions').expect(200);

      expect(response.body.owner).toEqual([...ALL_PERMISSIONS]);
      expect(response.body.admin).toEqual([...DEFAULT_ROLE_PERMISSIONS.admin]);
      expect(response.body.member).toEqual([...DEFAULT_ROLE_PERMISSIONS.member]);
    });

    it('should return 403 for non-owner', async () => {
      mockOrgGuard.canActivate.mockImplementation((context) => {
        const req = context.switchToHttp().getRequest();
        req.user = { sub: 2, username: 'admin' };
        req.orgMember = { orgId: 1, userId: 2, role: 'admin' };
        return true;
      });

      await request(app.getHttpServer()).get('/orgs/1/permissions').expect(403);
    });
  });

  describe('PUT /orgs/:orgId/permissions/:role', () => {
    it('should update permissions for admin role', async () => {
      mockPermissionsService.updateRolePermissions.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .put('/orgs/1/permissions/admin')
        .send({
          permissions: [Permission.AUTOMATIONS_VIEW, Permission.EXECUTIONS_VIEW],
        })
        .expect(204);

      expect(mockPermissionsService.updateRolePermissions).toHaveBeenCalledWith({
        orgId: 1,
        role: 'admin',
        permissions: [Permission.AUTOMATIONS_VIEW, Permission.EXECUTIONS_VIEW],
        requestingRole: 'owner',
      });
    });

    it('should update permissions for member role', async () => {
      mockPermissionsService.updateRolePermissions.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .put('/orgs/1/permissions/member')
        .send({
          permissions: [Permission.AUTOMATIONS_VIEW],
        })
        .expect(204);
    });

    it('should accept empty permissions array', async () => {
      mockPermissionsService.updateRolePermissions.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .put('/orgs/1/permissions/member')
        .send({ permissions: [] })
        .expect(204);
    });
  });
});
