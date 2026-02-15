import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ExecutionRepository } from '../executions/executions.repository';
import { AuditRepository } from '../audit/audit.repository';
import { NotificationRepository } from '../notifications/notifications.repository';
import { AuthRepository } from '../auth/auth.repository';
import {
  CLEANUP_QUEUE,
  EXECUTION_CLEANUP_JOB,
  AUDIT_CLEANUP_JOB,
  NOTIFICATION_CLEANUP_JOB,
  REFRESH_TOKEN_CLEANUP_JOB,
  type CleanupJobData,
} from './cleanup.constants';

@Processor(CLEANUP_QUEUE)
export class CleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(CleanupProcessor.name);

  constructor(
    @Inject(ExecutionRepository)
    private readonly executionRepository: ExecutionRepository,
    @Inject(AuditRepository)
    private readonly auditRepository: AuditRepository,
    @Inject(NotificationRepository)
    private readonly notificationRepository: NotificationRepository,
    @Inject(AuthRepository)
    private readonly authRepository: AuthRepository,
  ) {
    super();
  }

  async process(job: Job<CleanupJobData>): Promise<void> {
    switch (job.name) {
      case EXECUTION_CLEANUP_JOB:
        await this.handleExecutionCleanup(job);
        break;
      case AUDIT_CLEANUP_JOB:
        await this.handleAuditCleanup(job);
        break;
      case NOTIFICATION_CLEANUP_JOB:
        await this.handleNotificationCleanup(job);
        break;
      case REFRESH_TOKEN_CLEANUP_JOB:
        await this.handleRefreshTokenCleanup(job);
        break;
      default:
        this.logger.warn(`Unknown cleanup job: ${job.name}`);
    }
  }

  private async handleExecutionCleanup(job: Job<CleanupJobData>): Promise<void> {
    const { retentionDays } = job.data;

    this.logger.log(`Running execution cleanup (retention: ${retentionDays} days)`);

    const deletedLogs = await this.executionRepository.deleteLogsOlderThan({
      days: retentionDays,
    });
    const deletedExecutions = await this.executionRepository.deleteExecutionsOlderThan({
      days: retentionDays,
    });

    this.logger.log(
      `Execution cleanup complete: ${deletedExecutions} executions, ${deletedLogs} log entries removed`,
    );
  }

  private async handleAuditCleanup(job: Job<CleanupJobData>): Promise<void> {
    const { retentionDays } = job.data;

    this.logger.log(`Running audit cleanup (retention: ${retentionDays} days)`);

    const deleted = await this.auditRepository.deleteOlderThan({
      days: retentionDays,
    });

    this.logger.log(`Audit cleanup complete: ${deleted} entries removed`);
  }

  private async handleNotificationCleanup(job: Job<CleanupJobData>): Promise<void> {
    const { retentionDays } = job.data;

    this.logger.log(`Running notification cleanup (retention: ${retentionDays} days)`);

    const deleted = await this.notificationRepository.deleteOlderThan({
      days: retentionDays,
    });

    this.logger.log(`Notification cleanup complete: ${deleted} entries removed`);
  }

  private async handleRefreshTokenCleanup(job: Job<CleanupJobData>): Promise<void> {
    const { retentionDays } = job.data;

    this.logger.log(`Running refresh token cleanup (retention: ${retentionDays} days)`);

    const deleted = await this.authRepository.deleteExpiredTokens({
      days: retentionDays,
    });

    this.logger.log(`Refresh token cleanup complete: ${deleted} tokens removed`);
  }
}
