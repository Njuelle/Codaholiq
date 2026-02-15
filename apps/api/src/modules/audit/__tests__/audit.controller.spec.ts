import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuditController } from '../audit.controller';
import { AuditService } from '../audit.service';
import { OrgGuard } from '../../../common/guards/org.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

const mockAuditService = {
  findByOrgId: vi.fn(),
};

const mockOrgGuard = {
  canActivate: vi.fn().mockImplementation((context) => {
    const req = context.switchToHttp().getRequest();
    req.user = { sub: 1, username: 'testuser' };
    req.orgMember = { orgId: 1, userId: 1, role: 'owner' };
    return true;
  }),
};

describe('AuditController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [{ provide: AuditService, useValue: mockAuditService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrgGuard)
      .useValue(mockOrgGuard)
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /orgs/:orgId/audit-logs', () => {
    it('should return paginated audit logs', async () => {
      const mockItems = [
        {
          id: 1,
          orgId: 1,
          userId: 1,
          action: 'automation.created',
          resourceType: 'automation',
          resourceId: '42',
          details: null,
          ipAddress: '127.0.0.1',
          userAgent: 'TestAgent',
          createdAt: new Date().toISOString(),
        },
      ];
      mockAuditService.findByOrgId.mockResolvedValue({
        items: mockItems,
        total: 1,
      });

      const response = await request(app.getHttpServer()).get('/orgs/1/audit-logs').expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.meta).toEqual({
        total: 1,
        limit: 50,
        offset: 0,
      });
    });

    it('should pass query filters to service', async () => {
      mockAuditService.findByOrgId.mockResolvedValue({
        items: [],
        total: 0,
      });

      await request(app.getHttpServer())
        .get(
          '/orgs/1/audit-logs?action=automation.created&userId=2&resourceType=automation&limit=10&offset=5',
        )
        .expect(200);

      expect(mockAuditService.findByOrgId).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 1,
          action: 'automation.created',
          userId: 2,
          resourceType: 'automation',
          limit: 10,
          offset: 5,
        }),
      );
    });

    it('should use default pagination when not specified', async () => {
      mockAuditService.findByOrgId.mockResolvedValue({
        items: [],
        total: 0,
      });

      await request(app.getHttpServer()).get('/orgs/1/audit-logs').expect(200);

      expect(mockAuditService.findByOrgId).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 50,
          offset: 0,
        }),
      );
    });

    it('should return empty list when no logs exist', async () => {
      mockAuditService.findByOrgId.mockResolvedValue({
        items: [],
        total: 0,
      });

      const response = await request(app.getHttpServer()).get('/orgs/1/audit-logs').expect(200);

      expect(response.body.items).toEqual([]);
      expect(response.body.meta.total).toBe(0);
    });
  });
});
