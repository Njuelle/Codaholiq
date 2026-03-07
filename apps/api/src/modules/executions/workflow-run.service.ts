import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ExecutionRepository } from './executions.repository';
import {
  EXECUTION_QUEUE,
  COLLECT_LOGS_JOB,
  DEFAULT_JOB_OPTIONS,
  TERMINAL_STATUSES,
  mapConclusion,
  type CollectLogsJobData,
} from './executions.constants';

@Injectable()
export class WorkflowRunService {
  private readonly logger = new Logger(WorkflowRunService.name);

  constructor(
    @Inject(ExecutionRepository)
    private readonly executionRepository: ExecutionRepository,
    @InjectQueue(EXECUTION_QUEUE)
    private readonly executionQueue: Queue,
  ) {}

  async handleWorkflowRunCompleted({
    payload,
  }: {
    payload: Record<string, unknown>;
  }): Promise<void> {
    const workflowRun = payload.workflow_run as
      | {
          id?: number;
          conclusion?: string;
          html_url?: string;
        }
      | undefined;

    if (!workflowRun?.id) {
      this.logger.warn('workflow_run.completed payload missing run ID');
      return;
    }

    const execution = await this.executionRepository.findByGithubRunId({
      runId: workflowRun.id,
    });

    if (!execution) {
      this.logger.debug(`No execution found for GitHub run ID ${workflowRun.id}, ignoring`);
      return;
    }

    if (TERMINAL_STATUSES.has(execution.status)) {
      this.logger.debug(
        `Execution ${execution.id} already in terminal state (${execution.status}), ignoring webhook`,
      );
      return;
    }

    const status = mapConclusion(workflowRun.conclusion ?? null);

    await this.executionRepository.updateStatus({
      id: execution.id,
      status,
      fields: { completedAt: new Date() },
    });

    this.logger.log(
      `Execution ${execution.id} updated via webhook: ${workflowRun.conclusion} → ${status}`,
    );

    // Extract installation and repo info from the payload for log collection
    const installation = payload.installation as { id?: number } | undefined;
    const repository = payload.repository as
      | { owner?: { login?: string }; name?: string }
      | undefined;

    if (installation?.id && repository?.owner?.login && repository?.name) {
      await this.executionQueue.add(
        COLLECT_LOGS_JOB,
        {
          executionId: execution.id,
          githubRunId: workflowRun.id,
          installationId: installation.id,
          owner: repository.owner.login,
          repo: repository.name,
          provider: execution.provider,
        } satisfies CollectLogsJobData,
        DEFAULT_JOB_OPTIONS,
      );
    }
  }
}
