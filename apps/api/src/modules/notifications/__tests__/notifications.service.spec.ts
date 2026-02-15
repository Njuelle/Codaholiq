import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from '../notifications.service';
import { NotificationRepository } from '../notifications.repository';

function createMockRepository(): Record<
  keyof Pick<NotificationRepository, 'create' | 'findByOrgId' | 'deleteById' | 'countByOrgId'>,
  ReturnType<typeof vi.fn>
> {
  return {
    create: vi.fn().mockResolvedValue({
      id: 1,
      orgId: 1,
      executionId: 1,
      automationName: 'Test Automation',
      message: 'Execution failed',
      createdAt: new Date(),
    }),
    findByOrgId: vi.fn().mockResolvedValue([]),
    deleteById: vi.fn().mockResolvedValue(true),
    countByOrgId: vi.fn().mockResolvedValue(0),
  };
}

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockRepository: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    mockRepository = createMockRepository();
    service = new NotificationsService(mockRepository as unknown as NotificationRepository);
  });

  describe('list', () => {
    it('should return notifications from repository', async () => {
      const mockNotifications = [
        {
          id: 1,
          orgId: 1,
          executionId: 10,
          automationName: 'Deploy',
          message: 'Execution #10 of "Deploy" failed',
          createdAt: new Date(),
        },
      ];
      mockRepository.findByOrgId.mockResolvedValue(mockNotifications);

      const result = await service.list({ orgId: 1 });

      expect(result).toEqual(mockNotifications);
      expect(mockRepository.findByOrgId).toHaveBeenCalledWith({ orgId: 1, limit: undefined });
    });

    it('should pass limit to repository', async () => {
      mockRepository.findByOrgId.mockResolvedValue([]);

      await service.list({ orgId: 1, limit: 10 });

      expect(mockRepository.findByOrgId).toHaveBeenCalledWith({ orgId: 1, limit: 10 });
    });
  });

  describe('dismiss', () => {
    it('should delete the notification', async () => {
      mockRepository.deleteById.mockResolvedValue(true);

      await service.dismiss({ orgId: 1, notificationId: 5 });

      expect(mockRepository.deleteById).toHaveBeenCalledWith({
        id: 5,
        orgId: 1,
      });
    });

    it('should throw NotFoundException when notification does not exist', async () => {
      mockRepository.deleteById.mockResolvedValue(false);

      await expect(service.dismiss({ orgId: 1, notificationId: 99999 })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
