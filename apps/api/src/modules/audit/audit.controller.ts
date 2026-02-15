import { Controller, Get, Param, Query, ParseIntPipe, Inject, UseGuards } from '@nestjs/common';
import { OrgGuard } from '../../common/guards/org.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../permissions/permissions.constants';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuditService } from './audit.service';
import { ListAuditLogsQuerySchema, ListAuditLogsQuery } from './dto/list-audit-logs.dto';
import { auditLogs } from './audit.schema';

@Controller('orgs/:orgId/audit-logs')
@UseGuards(OrgGuard, PermissionGuard)
@RequirePermission(Permission.ORG_SETTINGS_VIEW)
export class AuditController {
  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  @Get()
  async list(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Query(new ZodValidationPipe(ListAuditLogsQuerySchema))
    query: ListAuditLogsQuery,
  ): Promise<{
    items: (typeof auditLogs.$inferSelect)[];
    meta: { total: number; limit: number; offset: number };
  }> {
    const { items, total } = await this.auditService.findByOrgId({
      orgId,
      action: query.action,
      userId: query.userId,
      resourceType: query.resourceType,
      from: query.from,
      to: query.to,
      limit: query.limit,
      offset: query.offset,
    });

    return {
      items,
      meta: {
        total,
        limit: query.limit,
        offset: query.offset,
      },
    };
  }
}
