import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Inject,
  UseGuards,
  Sse,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Observable } from 'rxjs';
import { OrgGuard } from '../../common/guards/org.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Permission } from '../permissions/permissions.constants';
import { Audit } from '../../common/decorators/audit.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ExecutionsService } from './executions.service';
import { ListExecutionsQuerySchema, ListExecutionsQuery } from './dto/list-executions.dto';
import { ExecutionLogsQuerySchema, ExecutionLogsQuery } from './dto/execution-logs-query.dto';
import { executions, executionLogs } from './executions.schema';
import type { SseMessageEvent } from './sse.types';

@Controller('orgs/:orgId/executions')
@UseGuards(OrgGuard, PermissionGuard)
export class ExecutionsController {
  constructor(
    @Inject(ExecutionsService)
    private readonly executionsService: ExecutionsService,
  ) {}

  @Get('stats')
  @RequirePermission(Permission.EXECUTIONS_VIEW)
  @Throttle({ default: { limit: 200, ttl: 60000 } })
  async getStats(
    @Param('orgId', ParseIntPipe) orgId: number,
  ): Promise<{ byStatus: { status: string; count: number }[] }> {
    return this.executionsService.getStats({ orgId });
  }

  @Get()
  @RequirePermission(Permission.EXECUTIONS_VIEW)
  @Throttle({ default: { limit: 200, ttl: 60000 } })
  async list(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Query(new ZodValidationPipe(ListExecutionsQuerySchema))
    query: ListExecutionsQuery,
  ): Promise<{
    items: {
      execution: typeof executions.$inferSelect;
      automationName: string;
    }[];
    meta: { total: number; limit: number; offset: number };
  }> {
    const { items, total } = await this.executionsService.list({
      orgId,
      filters: query,
    });
    return {
      items,
      meta: {
        total,
        limit: query.limit ?? 50,
        offset: query.offset ?? 0,
      },
    };
  }

  @Get(':executionId')
  @RequirePermission(Permission.EXECUTIONS_VIEW)
  @Throttle({ default: { limit: 200, ttl: 60000 } })
  async findById(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('executionId', ParseIntPipe) executionId: number,
  ): Promise<{
    execution: typeof executions.$inferSelect;
    automationName: string;
  }> {
    return this.executionsService.findById({ orgId, executionId });
  }

  @Get(':executionId/logs')
  @RequirePermission(Permission.EXECUTIONS_VIEW)
  @Throttle({ default: { limit: 200, ttl: 60000 } })
  async findLogs(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('executionId', ParseIntPipe) executionId: number,
    @Query(new ZodValidationPipe(ExecutionLogsQuerySchema))
    query: ExecutionLogsQuery,
  ): Promise<(typeof executionLogs.$inferSelect)[]> {
    return this.executionsService.findLogs({
      orgId,
      executionId,
      after: query.after,
      limit: query.limit,
    });
  }

  @Sse(':executionId/logs/stream')
  @RequirePermission(Permission.EXECUTIONS_VIEW)
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  streamLogs(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('executionId', ParseIntPipe) executionId: number,
  ): Observable<SseMessageEvent> {
    return this.executionsService.streamLogs({ orgId, executionId });
  }

  @Post(':executionId/cancel')
  @RequirePermission(Permission.EXECUTIONS_RETRY)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({
    action: 'execution.cancelled',
    resourceType: 'execution',
    resourceIdParam: 'executionId',
  })
  async cancel(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('executionId', ParseIntPipe) executionId: number,
  ): Promise<void> {
    await this.executionsService.cancel({ orgId, executionId });
  }

  @Post(':executionId/retry')
  @RequirePermission(Permission.EXECUTIONS_RETRY)
  @Audit({ action: 'execution.retried', resourceType: 'execution', resourceIdParam: 'executionId' })
  async retry(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('executionId', ParseIntPipe) executionId: number,
  ): Promise<typeof executions.$inferSelect> {
    return this.executionsService.retry({ orgId, executionId });
  }
}
