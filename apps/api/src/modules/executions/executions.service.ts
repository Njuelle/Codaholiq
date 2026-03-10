import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ExecutionRepository } from './executions.repository';
import { ExecutionLifecycleService } from './execution-lifecycle.service';
import { RedisLogPublisherService } from './redis-log-publisher.service';
import { executions, executionLogs } from './executions.schema';
import type { ListExecutionsQuery } from './dto/list-executions.dto';
import type { SseMessageEvent } from './sse.types';
import { TERMINAL_STATUSES } from './executions.constants';

const MAX_SSE_CONNECTIONS = 500;

@Injectable()
export class ExecutionsService {
  private readonly logger = new Logger(ExecutionsService.name);
  private activeSseConnections = 0;

  constructor(
    @Inject(ExecutionRepository)
    private readonly executionRepository: ExecutionRepository,
    @Inject(ExecutionLifecycleService)
    private readonly lifecycleService: ExecutionLifecycleService,
    @Inject(RedisLogPublisherService)
    private readonly redisLogPublisher: RedisLogPublisherService,
  ) {}

  async list({ orgId, filters }: { orgId: number; filters: ListExecutionsQuery }): Promise<{
    items: {
      execution: typeof executions.$inferSelect;
      automationName: string;
    }[];
    total: number;
  }> {
    const filterParams = {
      status: filters.status,
      automationId: filters.automationId,
      repoId: filters.repoId,
      limit: filters.limit,
      offset: filters.offset,
    };

    const [items, total] = await Promise.all([
      this.executionRepository.findByOrgId({ orgId, filters: filterParams }),
      this.executionRepository.countByOrgId({
        orgId,
        filters: {
          status: filters.status,
          automationId: filters.automationId,
          repoId: filters.repoId,
        },
      }),
    ]);

    return { items, total };
  }

  async findById({ orgId, executionId }: { orgId: number; executionId: number }): Promise<{
    execution: typeof executions.$inferSelect;
    automationName: string;
  }> {
    const result = await this.executionRepository.findById({ id: executionId });
    if (!result || result.orgId !== orgId) {
      throw new NotFoundException('Execution not found');
    }
    return {
      execution: result.execution,
      automationName: result.automationName,
    };
  }

  async findLogs({
    orgId,
    executionId,
    after,
    limit,
  }: {
    orgId: number;
    executionId: number;
    after?: string;
    limit?: number;
  }): Promise<(typeof executionLogs.$inferSelect)[]> {
    // Verify execution belongs to org
    const result = await this.executionRepository.findById({ id: executionId });
    if (!result || result.orgId !== orgId) {
      throw new NotFoundException('Execution not found');
    }

    return this.executionRepository.findLogs({
      executionId,
      after: after ? new Date(after) : undefined,
      limit,
    });
  }

  async cancel({ orgId, executionId }: { orgId: number; executionId: number }): Promise<void> {
    const result = await this.executionRepository.findById({ id: executionId });
    if (!result || result.orgId !== orgId) {
      throw new NotFoundException('Execution not found');
    }
    await this.lifecycleService.cancel({ executionId });
  }

  async retry({
    orgId,
    executionId,
  }: {
    orgId: number;
    executionId: number;
  }): Promise<typeof executions.$inferSelect> {
    const result = await this.executionRepository.findById({ id: executionId });
    if (!result || result.orgId !== orgId) {
      throw new NotFoundException('Execution not found');
    }
    return this.lifecycleService.retry({ executionId });
  }

  async getStats({ orgId }: { orgId: number }): Promise<{
    byStatus: { status: string; count: number }[];
  }> {
    const byStatus = await this.executionRepository.countByStatus({ orgId });
    return { byStatus };
  }

  async countByStatusInDateRange({
    orgId,
    since,
  }: {
    orgId: number;
    since: Date;
  }): Promise<{ status: string; count: number }[]> {
    return this.executionRepository.countByStatusInDateRange({ orgId, since });
  }

  async listRecent({
    orgId,
    limit,
  }: {
    orgId: number;
    limit: number;
  }): Promise<{ execution: typeof executions.$inferSelect; automationName: string }[]> {
    return this.executionRepository.findByOrgId({
      orgId,
      filters: { limit },
    });
  }

  streamLogs({
    orgId,
    executionId,
  }: {
    orgId: number;
    executionId: number;
  }): Observable<SseMessageEvent> {
    return new Observable<SseMessageEvent>((subscriber) => {
      // Guard against too many concurrent SSE connections
      if (this.activeSseConnections >= MAX_SSE_CONNECTIONS) {
        this.logger.warn(
          `SSE connection limit reached (${MAX_SSE_CONNECTIONS}), rejecting stream for execution ${executionId}`,
        );
        subscriber.error(new Error('Too many active SSE connections'));
        return;
      }
      this.activeSseConnections++;

      let isTerminal = false;
      let tornDown = false;
      let unsubscribeRedis: (() => void) | undefined;

      const cleanup = (): void => {
        if (tornDown) return;
        tornDown = true;
        this.activeSseConnections--;
        unsubscribeRedis?.();
      };

      const init = async (): Promise<void> => {
        try {
          // If client already disconnected during async init, bail out
          if (tornDown) return;

          // Verify execution belongs to org
          const result = await this.executionRepository.findById({
            id: executionId,
          });
          if (!result || result.orgId !== orgId) {
            subscriber.complete();
            return;
          }

          // Send existing logs from DB
          const existingLogs = await this.executionRepository.findLogs({
            executionId,
          });
          for (const log of existingLogs) {
            subscriber.next({
              data: JSON.stringify(log),
              type: 'log',
            });
          }

          // If already terminal, send status and complete
          if (TERMINAL_STATUSES.has(result.execution.status)) {
            subscriber.next({
              data: JSON.stringify({ status: result.execution.status }),
              type: 'status',
            });
            isTerminal = true;
            subscriber.complete();
            return;
          }

          // If client disconnected while we were fetching, skip Redis subscription
          if (tornDown) return;

          // Subscribe to Redis for real-time updates
          unsubscribeRedis = this.redisLogPublisher.subscribe({
            executionId,
            onMessage: (message) => {
              subscriber.next({
                data: message.data,
                type: message.type,
              });

              if (message.type === 'status') {
                isTerminal = true;
                subscriber.complete();
              }
            },
          });
        } catch (error) {
          this.logger.error(
            `SSE stream init failed for execution ${executionId}: ${error instanceof Error ? error.message : String(error)}`,
          );
          subscriber.error(error);
        }
      };

      void init();

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        if (!isTerminal) {
          subscriber.next({ data: '', type: 'heartbeat' });
        }
      }, 15000);

      // Teardown: called by RxJS when client disconnects or stream completes
      return () => {
        clearInterval(heartbeat);
        cleanup();
      };
    });
  }

  async getCostOverTime({
    orgId,
    from,
    to,
    repoId,
  }: {
    orgId: number;
    from: Date;
    to: Date;
    repoId?: number;
  }): Promise<
    {
      date: string;
      totalCostMicros: number;
      totalInputTokens: number;
      totalOutputTokens: number;
      executionCount: number;
    }[]
  > {
    return this.executionRepository.costOverTime({ orgId, from, to, repoId });
  }

  async getCostStats({
    orgId,
    since,
    repoId,
  }: {
    orgId: number;
    since: Date;
    repoId?: number;
  }): Promise<{
    totalCostMicros: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    executionsWithCost: number;
  }> {
    return this.executionRepository.sumCostInDateRange({ orgId, since, repoId });
  }

  async getCostByProvider({
    orgId,
    since,
    repoId,
  }: {
    orgId: number;
    since: Date;
    repoId?: number;
  }): Promise<
    { provider: string; model: string | null; totalCostMicros: number; count: number }[]
  > {
    return this.executionRepository.sumCostByProviderInDateRange({ orgId, since, repoId });
  }

  async getTopCostliestAutomations({
    orgId,
    since,
    limit,
    repoId,
  }: {
    orgId: number;
    since: Date;
    limit: number;
    repoId?: number;
  }): Promise<
    {
      automationId: number;
      automationName: string;
      totalCostMicros: number;
      executionCount: number;
      totalInputTokens: number;
      totalOutputTokens: number;
    }[]
  > {
    return this.executionRepository.topCostliestAutomations({ orgId, since, limit, repoId });
  }
}
