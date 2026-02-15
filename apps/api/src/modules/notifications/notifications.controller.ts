import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  ParseIntPipe,
  Inject,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrgGuard } from '../../common/guards/org.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../permissions/permissions.constants';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { NotificationsService } from './notifications.service';
import {
  ListNotificationsQuerySchema,
  type ListNotificationsQuery,
  type NotificationDto,
} from './dto/notifications.dto';

@Controller('orgs/:orgId/notifications')
@UseGuards(OrgGuard, PermissionGuard)
export class NotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get()
  @RequirePermission(Permission.NOTIFICATIONS_VIEW)
  async list(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Query(new ZodValidationPipe(ListNotificationsQuerySchema))
    query: ListNotificationsQuery,
  ): Promise<NotificationDto[]> {
    return this.notificationsService.list({ orgId, limit: query.limit });
  }

  @Delete(':notificationId')
  @RequirePermission(Permission.NOTIFICATIONS_DISMISS)
  @HttpCode(HttpStatus.NO_CONTENT)
  async dismiss(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('notificationId', ParseIntPipe) notificationId: number,
  ): Promise<void> {
    await this.notificationsService.dismiss({ orgId, notificationId });
  }
}
