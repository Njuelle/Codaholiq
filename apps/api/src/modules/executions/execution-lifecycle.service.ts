import { Injectable, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { getMonthStart } from '../../common/date-utils';
import { ExecutionRepository } from './executions.repository';
import { GitHubEntityRepository } from '../github/github-entity.repository';
import { GitHubApiService } from '../github/github-api.service';
import { executions } from './executions.schema';
import {
  EXECUTION_QUEUE,
  DISPATCH_JOB,
  DEFAULT_JOB_OPTIONS,
  TERMINAL_STATUSES,
  type DispatchJobData,
} from './executions.constants';
import { DEFAULT_WORKFLOW_FILE } from '../automations/automations.schema';

@Injectable()
export class ExecutionLifecycleService {
  private readonly logger = new Logger(ExecutionLifecycleService.name);
  private readonly maxConcurrentExecutionsPerOrg: number;

  constructor(
    @Inject(ExecutionRepository)
    private readonly executionRepository: ExecutionRepository,
    @Inject(GitHubEntityRepository)
    private readonly githubEntityRepository: GitHubEntityRepository,
    @Inject(GitHubApiService)
    private readonly githubApiService: GitHubApiService,
    @InjectQueue(EXECUTION_QUEUE)
    private readonly executionQueue: Queue,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {
    this.maxConcurrentExecutionsPerOrg = parseInt(
      this.configService.get<string>('MAX_CONCURRENT_EXECUTIONS_PER_ORG') ?? '50',
      10,
    );
  }

  async createAndQueue({
    automationId,
    automationName,
    repoId,
    workflowFile,
    triggerEvent,
    resolvedPrompt,
    provider,
    model,
    monthlyCostLimitMicros,
  }: {
    automationId: number;
    automationName: string;
    repoId: number;
    workflowFile: string;
    triggerEvent?: Record<string, unknown> | null;
    resolvedPrompt: string;
    provider: string;
    model?: string | null;
    monthlyCostLimitMicros?: number | null;
  }): Promise<typeof executions.$inferSelect> {
    // Look up orgId from the repo to enforce concurrent execution quota
    const repo = await this.githubEntityRepository.findRepositoryById({ id: repoId });
    if (repo) {
      const activeCount = await this.executionRepository.countActiveByOrgId({
        orgId: repo.orgId,
      });
      if (activeCount >= this.maxConcurrentExecutionsPerOrg) {
        throw new BadRequestException(
          `Organization has reached the maximum of ${this.maxConcurrentExecutionsPerOrg} concurrent executions`,
        );
      }
    }

    // Check monthly cost limit before dispatching.
    // Uses an advisory lock to prevent concurrent triggers from bypassing the limit.
    if (monthlyCostLimitMicros != null) {
      const blocked = await this.checkCostLimitWithLock({
        automationId,
        monthlyCostLimitMicros,
        triggerEvent,
        resolvedPrompt,
        provider,
        model,
      });
      if (blocked) return blocked;
    }

    const execution = await this.executionRepository.create({
      automationId,
      triggerEvent,
      resolvedPrompt,
      provider,
      model,
    });

    try {
      const dispatchData = await this.buildDispatchJobData({
        executionId: execution.id,
        automationId,
        automationName,
        repoId,
        workflowFile,
        provider,
        model,
      });

      await this.executionQueue.add(DISPATCH_JOB, dispatchData, DEFAULT_JOB_OPTIONS);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to queue dispatch for execution ${execution.id}: ${errorMessage}`);
      await this.executionRepository.updateStatus({
        id: execution.id,
        status: 'failed',
        fields: {
          errorMessage: `Failed to queue dispatch: ${errorMessage}`,
          completedAt: new Date(),
        },
      });
      throw error;
    }

    this.logger.log(`Queued dispatch for execution ${execution.id} (automation ${automationId})`);

    return execution;
  }

  async cancel({ executionId }: { executionId: number }): Promise<void> {
    const result = await this.executionRepository.findById({ id: executionId });
    if (!result) {
      throw new NotFoundException(`Execution ${executionId} not found`);
    }

    const { execution } = result;

    if (TERMINAL_STATUSES.has(execution.status)) {
      return; // Already in terminal state — no-op
    }

    if (execution.status === 'pending' || execution.status === 'dispatching') {
      await this.executionRepository.updateStatus({
        id: executionId,
        status: 'cancelled',
        fields: { completedAt: new Date() },
      });
      this.logger.log(`Cancelled pending/dispatching execution ${executionId}`);
      return;
    }

    if (execution.status === 'running') {
      // Best-effort cancel on GitHub if we have a run ID
      if (execution.githubRunId) {
        const dispatchInfo = await this.executionRepository.findByIdWithAutomationInfo({
          id: executionId,
        });
        if (dispatchInfo) {
          const repo = await this.githubEntityRepository.findRepositoryById({
            id: dispatchInfo.repoId,
          });
          if (repo) {
            const installation = await this.githubEntityRepository.findInstallationById({
              id: repo.installationId,
            });
            if (installation) {
              try {
                await this.githubApiService.cancelWorkflowRun({
                  installationId: installation.installationId,
                  owner: repo.owner,
                  repo: repo.name,
                  runId: execution.githubRunId,
                });
              } catch (error) {
                this.logger.warn(
                  `Failed to cancel GitHub workflow run ${execution.githubRunId}: ${error instanceof Error ? error.message : String(error)}`,
                );
              }
            }
          }
        }
      }

      await this.executionRepository.updateStatus({
        id: executionId,
        status: 'cancelled',
        fields: { completedAt: new Date() },
      });
      this.logger.log(`Cancelled running execution ${executionId}`);
    }
  }

  async retry({ executionId }: { executionId: number }): Promise<typeof executions.$inferSelect> {
    const result = await this.executionRepository.findByIdWithAutomationInfo({
      id: executionId,
    });
    if (!result) {
      throw new NotFoundException(`Execution ${executionId} not found`);
    }

    const { execution, automationName, repoId, monthlyCostLimitMicros } = result;

    if (!TERMINAL_STATUSES.has(execution.status)) {
      throw new BadRequestException(
        `Execution ${executionId} is not in a terminal state (current: ${execution.status})`,
      );
    }

    return this.createAndQueue({
      automationId: execution.automationId,
      automationName,
      repoId,
      workflowFile: DEFAULT_WORKFLOW_FILE,
      triggerEvent: (execution.triggerEvent as Record<string, unknown>) ?? null,
      resolvedPrompt: execution.resolvedPrompt,
      provider: execution.provider,
      model: execution.model,
      monthlyCostLimitMicros,
    });
  }

  private async checkCostLimitWithLock({
    automationId,
    monthlyCostLimitMicros,
    triggerEvent,
    resolvedPrompt,
    provider,
    model,
  }: {
    automationId: number;
    monthlyCostLimitMicros: number;
    triggerEvent?: Record<string, unknown> | null;
    resolvedPrompt: string;
    provider: string;
    model?: string | null;
  }): Promise<typeof executions.$inferSelect | null> {
    return this.db.transaction(async (tx) => {
      // Advisory lock scoped to this automation prevents concurrent cost-check bypass
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${automationId})`);

      const monthStart = getMonthStart();
      const currentCost = await this.executionRepository.sumCostByAutomationInMonth({
        automationId,
        monthStart,
      });

      if (currentCost < monthlyCostLimitMicros) return null;

      const limitDollars = (monthlyCostLimitMicros / 1_000_000).toFixed(2);
      const spentDollars = (currentCost / 1_000_000).toFixed(2);

      const blockedExecution = await this.executionRepository.create({
        automationId,
        triggerEvent,
        resolvedPrompt,
        provider,
        model,
      });

      await this.executionRepository.updateStatus({
        id: blockedExecution.id,
        status: 'cost_blocked',
        fields: {
          errorMessage: `Monthly cost limit exceeded: $${spentDollars} spent of $${limitDollars} limit`,
          completedAt: new Date(),
        },
      });

      this.logger.warn(
        `Blocked execution ${blockedExecution.id} for automation ${automationId}: monthly cost limit exceeded ($${spentDollars}/$${limitDollars})`,
      );

      return { ...blockedExecution, status: 'cost_blocked' as const };
    });
  }

  private async buildDispatchJobData({
    executionId,
    automationId,
    automationName,
    repoId,
    workflowFile,
    provider,
    model,
  }: {
    executionId: number;
    automationId: number;
    automationName: string;
    repoId: number;
    workflowFile: string;
    provider: string;
    model?: string | null;
  }): Promise<DispatchJobData> {
    const repo = await this.githubEntityRepository.findRepositoryById({
      id: repoId,
    });
    if (!repo) {
      throw new NotFoundException(`Repository ${repoId} not found`);
    }

    const installation = await this.githubEntityRepository.findInstallationById({
      id: repo.installationId,
    });
    if (!installation) {
      throw new NotFoundException(`Installation for repository ${repo.fullName} not found`);
    }

    return {
      executionId,
      automationId,
      automationName,
      installationId: installation.installationId,
      owner: repo.owner,
      repo: repo.name,
      workflowFile,
      ref: repo.defaultBranch,
      provider,
      ...(model ? { model } : {}),
    };
  }
}
