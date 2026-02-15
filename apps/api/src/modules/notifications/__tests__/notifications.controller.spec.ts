import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { NotificationsController } from '../notifications.controller';
import { NotificationsService } from '../notifications.service';
import { OrgGuard } from '../../../common/guards/org.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { NotFoundException } from '@nestjs/common';

const mockNotificationsService = {
  list: vi.fn(),
  dismiss: vi.fn(),
};

const mockOrgGuard = {
  canActivate: vi.fn().mockImplementation((context) => {
    const req = context.switchToHttp().getRequest();
    req.user = { sub: 1, username: 'testuser' };
    req.orgMember = { orgId: 1, userId: 1, role: 'owner' };
    return true;
  }),
};

describe('NotificationsController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
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

  describe('GET /orgs/:orgId/notifications', () => {
    it('should return notifications list', async () => {
      const mockNotifications = [
        {
          id: 1,
          orgId: 1,
          executionId: 10,
          automationName: 'Deploy',
          message: 'Execution #10 of "Deploy" failed',
          createdAt: new Date().toISOString(),
        },
        {
          id: 2,
          orgId: 1,
          executionId: 20,
          automationName: 'Lint',
          message: 'Execution #20 of "Lint" failed',
          createdAt: new Date().toISOString(),
        },
      ];
      mockNotificationsService.list.mockResolvedValue(mockNotifications);

      const response = await request(app.getHttpServer()).get('/orgs/1/notifications').expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].automationName).toBe('Deploy');
      expect(mockNotificationsService.list).toHaveBeenCalledWith({
        orgId: 1,
        limit: undefined,
      });
    });

    it('should pass limit query param to service', async () => {
      mockNotificationsService.list.mockResolvedValue([]);

      await request(app.getHttpServer()).get('/orgs/1/notifications?limit=10').expect(200);

      expect(mockNotificationsService.list).toHaveBeenCalledWith({
        orgId: 1,
        limit: 10,
      });
    });

    it('should return empty array when no notifications', async () => {
      mockNotificationsService.list.mockResolvedValue([]);

      const response = await request(app.getHttpServer()).get('/orgs/1/notifications').expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('DELETE /orgs/:orgId/notifications/:notificationId', () => {
    it('should dismiss a notification and return 204', async () => {
      mockNotificationsService.dismiss.mockResolvedValue(undefined);

      await request(app.getHttpServer()).delete('/orgs/1/notifications/5').expect(204);

      expect(mockNotificationsService.dismiss).toHaveBeenCalledWith({
        orgId: 1,
        notificationId: 5,
      });
    });

    it('should return 404 when notification not found', async () => {
      mockNotificationsService.dismiss.mockRejectedValue(
        new NotFoundException('Notification not found'),
      );

      await request(app.getHttpServer()).delete('/orgs/1/notifications/99999').expect(404);
    });
  });
});
