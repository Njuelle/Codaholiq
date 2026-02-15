import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { NotificationRepository } from './notifications.repository';
import type { NotificationDto } from './dto/notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NotificationRepository)
    private readonly notificationRepository: NotificationRepository,
  ) {}

  async list({ orgId, limit }: { orgId: number; limit?: number }): Promise<NotificationDto[]> {
    return this.notificationRepository.findByOrgId({ orgId, limit });
  }

  async dismiss({
    orgId,
    notificationId,
  }: {
    orgId: number;
    notificationId: number;
  }): Promise<void> {
    const deleted = await this.notificationRepository.deleteById({
      id: notificationId,
      orgId,
    });
    if (!deleted) {
      throw new NotFoundException('Notification not found');
    }
  }
}
