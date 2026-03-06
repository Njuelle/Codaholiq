import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import AdmZip from 'adm-zip';
import { ExecutionRepository } from './executions.repository';
import { extractCostFromLogs } from './cost-extractor';
import { GitHubApiService } from '../github/github-api.service';
import { NotificationRepository } from '../notifications/notifications.repository';
import { RedisLogPublisherService } from './redis-log-publisher.service';
import { JobFailureTrackerService } from '../../common/monitoring/job-failure-tracker.service';
import { SecretMaskingService } from '../../common/crypto/secret-masking.service';
import { ProvidersRegistry } from '../providers/providers.registry';
import {
  EXECUTION_QUEUE,
  DISPATCH_JOB,
  POLL_STATUS_JOB,
  COLLECT_LOGS_JOB,
  DEFAULT_JOB_OPTIONS,
  TERMINAL_STATUSES,
  mapConclusion,
  type DispatchJobData,
  type PollStatusJobData,
  type CollectLogsJobData,
} from './executions.constants';

const POLL_DELAY_MS = 30_000;
const MAX_POLL_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours
const RUN_ID_POLL_ATTEMPTS = 5;
const RUN_ID_POLL_INTERVAL_MS = 3_000;
const MAX_LOG_ENTRIES = 1000;
const MAX_LOG_MESSAGE_LENGTH = 4000;
const MAX_ZIP_SIZE = 50 * 1024 * 1024; // 50MB compressed
const MAX_ENTRY_SIZE = 10 * 1024 * 1024; // 10MB per decompressed entry

@Processor(EXECUTION_QUEUE, { concurrency: 5 })
export class ExecutionProcessor extends WorkerHost {
  private readonly logger = new Logger(ExecutionProcessor.name);

  constructor(
    @Inject(ExecutionRepository)
    private readonly executionRepository: ExecutionRepository,
    @Inject(GitHubApiService)
    private readonly githubApiService: GitHubApiService,
    @InjectQueue(EXECUTION_QUEUE)
    private readonly executionQueue: Queue,
    @Inject(NotificationRepository)
    private readonly notificationRepository: NotificationRepository,
    @Inject(RedisLogPublisherService)
    private readonly redisLogPublisher: RedisLogPublisherService,
    @Inject(JobFailureTrackerService)
    private readonly failureTracker: JobFailureTrackerService,
    @Inject(SecretMaskingService)
    private readonly secretMasking: SecretMaskingService,
    @Inject(ProvidersRegistry)
    private readonly providersRegistry: ProvidersRegistry,
  ) {
    super();
  }

  async process(job: Job<DispatchJobData | PollStatusJobData | CollectLogsJobData>): Promise<void> {
    switch (job.name) {
      case DISPATCH_JOB:
        await this.handleDispatch(job as Job<DispatchJobData>);
        break;
      case POLL_STATUS_JOB:
        await this.handlePollStatus(job as Job<PollStatusJobData>);
        break;
      case COLLECT_LOGS_JOB:
        await this.handleCollectLogs(job as Job<CollectLogsJobData>);
        break;
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async handleDispatch(job: Job<DispatchJobData>): Promise<void> {
    const { executionId, installationId, owner, repo, workflowFile, ref } = job.data;

    // Fetch resolvedPrompt from DB instead of Redis job data (SEC-002)
    const executionRecord = await this.executionRepository.findById({ id: executionId });
    if (!executionRecord) {
      this.logger.warn(`Execution ${executionId} not found, skipping dispatch`);
      return;
    }
    const resolvedPrompt = executionRecord.execution.resolvedPrompt;

    this.logger.log(
      `Dispatching workflow ${workflowFile} on ${owner}/${repo} for execution ${executionId}`,
    );

    await this.executionRepository.updateStatus({
      id: executionId,
      status: 'dispatching',
      fields: { startedAt: new Date() },
    });

    const dispatchTimestamp = new Date().toISOString();

    try {
      const inputs = this.providersRegistry.mapDispatchInputs({
        providerId: job.data.provider,
        prompt: resolvedPrompt,
        model: job.data.model,
      });

      await this.githubApiService.dispatchWorkflow({
        installationId,
        owner,
        repo,
        workflowFile,
        ref,
        inputs,
      });
    } catch (error) {
      this.failureTracker.trackFailure({ jobType: 'execution.dispatch', error });
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to dispatch workflow for execution ${executionId}: ${errorMessage}`,
      );
      await this.executionRepository.updateStatus({
        id: executionId,
        status: 'failed',
        fields: { errorMessage, completedAt: new Date() },
      });
      await this.createFailureNotification({ executionId });
      throw error; // Re-throw for BullMQ retry
    }

    // Poll for the triggered run ID
    const run = await this.detectWorkflowRun({
      installationId,
      owner,
      repo,
      workflowFile,
      createdAfter: dispatchTimestamp,
    });

    if (run) {
      await this.executionRepository.updateStatus({
        id: executionId,
        status: 'running',
        fields: {
          githubRunId: run.id,
          githubRunUrl: run.html_url,
        },
      });

      this.logger.log(`Workflow dispatched for execution ${executionId}, run ID: ${run.id}`);

      await this.executionQueue.add(
        POLL_STATUS_JOB,
        {
          executionId,
          githubRunId: run.id,
          installationId,
          owner,
          repo,
          dispatchedAt: dispatchTimestamp,
        } satisfies PollStatusJobData,
        { ...DEFAULT_JOB_OPTIONS, delay: POLL_DELAY_MS },
      );
    } else {
      this.logger.warn(
        `Could not detect run ID after dispatch for execution ${executionId}, queuing poll anyway`,
      );
      // Still mark as running — the webhook handler may catch the completion
      await this.executionRepository.updateStatus({
        id: executionId,
        status: 'running',
      });
    }

    const dispatchLog = {
      executionId,
      level: 'info' as const,
      message: `Dispatched workflow ${workflowFile} on ${owner}/${repo}@${ref}`,
      metadata: run ? { githubRunId: run.id, githubRunUrl: run.html_url } : null,
    };
    await this.executionRepository.appendLog(dispatchLog);
    await this.redisLogPublisher.publishLog({ executionId, log: dispatchLog });
  }

  private async handlePollStatus(job: Job<PollStatusJobData>): Promise<void> {
    const { executionId, githubRunId, installationId, owner, repo, dispatchedAt } = job.data;

    // Guard: check if execution is already in a terminal state
    const result = await this.executionRepository.findById({ id: executionId });
    if (!result) {
      this.logger.warn(`Execution ${executionId} not found, skipping poll`);
      return;
    }
    if (TERMINAL_STATUSES.has(result.execution.status)) {
      this.logger.log(
        `Execution ${executionId} already in terminal state (${result.execution.status}), skipping poll`,
      );
      return;
    }

    // Check 2h timeout
    const elapsed = Date.now() - new Date(dispatchedAt).getTime();
    if (elapsed > MAX_POLL_DURATION_MS) {
      this.logger.warn(
        `Execution ${executionId} exceeded 2h polling timeout, marking as timed_out`,
      );
      await this.executionRepository.updateStatus({
        id: executionId,
        status: 'timed_out',
        fields: {
          errorMessage: 'Workflow run exceeded 2-hour timeout',
          completedAt: new Date(),
        },
      });
      return;
    }

    const run = await this.githubApiService.getWorkflowRun({
      installationId,
      owner,
      repo,
      runId: githubRunId,
    });

    if (run.status === 'completed') {
      const executionStatus = mapConclusion(run.conclusion);

      await this.executionRepository.updateStatus({
        id: executionId,
        status: executionStatus,
        fields: { completedAt: new Date() },
      });

      await this.redisLogPublisher.publishStatus({ executionId, status: executionStatus });

      if (executionStatus === 'failed') {
        await this.createFailureNotification({ executionId });
      }

      this.logger.log(
        `Execution ${executionId}: workflow completed with conclusion: ${run.conclusion}`,
      );

      // Queue log collection (include provider for cost extraction)
      await this.executionQueue.add(
        COLLECT_LOGS_JOB,
        {
          executionId,
          githubRunId,
          installationId,
          owner,
          repo,
          provider: result.execution.provider,
        } satisfies CollectLogsJobData,
        DEFAULT_JOB_OPTIONS,
      );
    } else {
      this.logger.log(
        `Execution ${executionId}: workflow still ${run.status}, polling again in 30s`,
      );

      // Re-queue poll
      await this.executionQueue.add(POLL_STATUS_JOB, job.data, {
        ...DEFAULT_JOB_OPTIONS,
        delay: POLL_DELAY_MS,
      });
    }
  }

  private async handleCollectLogs(job: Job<CollectLogsJobData>): Promise<void> {
    const { executionId, githubRunId, installationId, owner, repo, provider } = job.data;

    this.logger.log(`Collecting logs for execution ${executionId}, run ${githubRunId}`);

    try {
      const logsBuffer = await this.githubApiService.getWorkflowRunLogs({
        installationId,
        owner,
        repo,
        runId: githubRunId,
      });

      const logEntries = this.parseWorkflowLogs({ logsBuffer });

      // Extract cost data from logs (provider-specific patterns)
      if (provider) {
        try {
          const costData = extractCostFromLogs({ provider, logEntries });
          if (costData) {
            await this.executionRepository.updateCost({
              executionId,
              inputTokens: costData.inputTokens,
              outputTokens: costData.outputTokens,
              totalCostMicros: costData.totalCostMicros,
            });
            this.logger.log(
              `Extracted cost for execution ${executionId}: ${costData.totalCostMicros !== null ? `${String(costData.totalCostMicros)} micros` : 'tokens only'}`,
            );
          }
        } catch (costError) {
          this.logger.warn(
            `Failed to extract cost for execution ${executionId}: ${costError instanceof Error ? costError.message : String(costError)}`,
          );
        }
      }

      const logsToInsert = logEntries.map((entry) => ({
        executionId,
        level: 'info' as const,
        message: this.secretMasking.mask({ text: entry.message }),
        metadata: entry.metadata,
      }));

      const insertedLogs = await this.executionRepository.appendLogs({
        logs: logsToInsert,
      });

      for (const log of insertedLogs) {
        await this.redisLogPublisher.publishLog({ executionId, log });
      }

      this.logger.log(`Collected ${logEntries.length} log entries for execution ${executionId}`);
    } catch (error) {
      this.failureTracker.trackFailure({ jobType: 'execution.collect_logs', error });
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to collect logs for execution ${executionId}: ${errorMessage}`);

      const errorLog = {
        executionId,
        level: 'error' as const,
        message: `Failed to collect workflow logs: ${errorMessage}`,
      };
      await this.executionRepository.appendLog(errorLog);
      await this.redisLogPublisher.publishLog({ executionId, log: errorLog });
    }
  }

  private async detectWorkflowRun({
    installationId,
    owner,
    repo,
    workflowFile,
    createdAfter,
  }: {
    installationId: number;
    owner: string;
    repo: string;
    workflowFile: string;
    createdAfter: string;
  }): Promise<{ id: number; html_url: string } | undefined> {
    for (let attempt = 0; attempt < RUN_ID_POLL_ATTEMPTS; attempt++) {
      const runs = await this.githubApiService.listWorkflowRuns({
        installationId,
        owner,
        repo,
        workflowFile,
        createdAfter,
      });

      if (runs.length > 0) {
        return { id: runs[0].id, html_url: runs[0].html_url };
      }

      // Sleep after check, not before — avoids wasting time on first attempt
      if (attempt < RUN_ID_POLL_ATTEMPTS - 1) {
        await this.sleep(RUN_ID_POLL_INTERVAL_MS);
      }
    }
    return undefined;
  }

  parseWorkflowLogs({
    logsBuffer,
  }: {
    logsBuffer: ArrayBuffer;
  }): { message: string; metadata?: Record<string, unknown> | null }[] {
    try {
      if (logsBuffer.byteLength > MAX_ZIP_SIZE) {
        this.logger.warn(
          `ZIP archive too large (${String(logsBuffer.byteLength)} bytes), skipping log parsing`,
        );
        return [{ message: 'Workflow logs ZIP archive exceeded size limit', metadata: null }];
      }

      const zip = new AdmZip(Buffer.from(logsBuffer));
      const entries: {
        message: string;
        metadata?: Record<string, unknown> | null;
      }[] = [];

      for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue;
        if (entries.length >= MAX_LOG_ENTRIES) break;

        // Check decompressed size before extracting to prevent ZIP bombs
        if (entry.header.size > MAX_ENTRY_SIZE) {
          this.logger.warn(
            `ZIP entry ${entry.entryName} too large (${String(entry.header.size)} bytes), skipping`,
          );
          continue;
        }

        const content = entry.getData().toString('utf-8');
        const lines = content.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          if (entries.length >= MAX_LOG_ENTRIES) break;

          // Strip ANSI escape codes
          const cleanLine = line.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');

          const trimmed = cleanLine.trim();
          if (trimmed) {
            entries.push({
              message:
                trimmed.length > MAX_LOG_MESSAGE_LENGTH
                  ? trimmed.slice(0, MAX_LOG_MESSAGE_LENGTH) + '...'
                  : trimmed,
              metadata: { file: entry.entryName },
            });
          }
        }
      }

      return entries;
    } catch {
      // If ZIP parsing fails, store the raw error
      return [
        {
          message: 'Failed to parse workflow logs ZIP archive',
          metadata: null,
        },
      ];
    }
  }

  private async createFailureNotification({ executionId }: { executionId: number }): Promise<void> {
    try {
      const result = await this.executionRepository.findById({
        id: executionId,
      });
      if (!result) return;

      await this.notificationRepository.create({
        orgId: result.orgId,
        executionId,
        automationName: result.automationName,
        message: `Execution #${executionId} of "${result.automationName}" failed`,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to create notification for execution ${executionId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
