import { Module, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { ExecutionsModule } from '../executions/executions.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';
import { CleanupProcessor } from './cleanup.processor';
import {
  CLEANUP_QUEUE,
  EXECUTION_CLEANUP_JOB,
  AUDIT_CLEANUP_JOB,
  NOTIFICATION_CLEANUP_JOB,
  REFRESH_TOKEN_CLEANUP_JOB,
} from './cleanup.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: CLEANUP_QUEUE }),
    ExecutionsModule,
    AuditModule,
    NotificationsModule,
    AuthModule,
  ],
  providers: [CleanupProcessor],
})
export class CleanupModule implements OnModuleInit {
  private readonly logger = new Logger(CleanupModule.name);

  constructor(
    @InjectQueue(CLEANUP_QUEUE) private readonly cleanupQueue: Queue,
    @Inject(ConfigService) private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.scheduleCleanupJobs();
    } catch (error) {
      this.logger.error(
        `Failed to schedule cleanup jobs: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async scheduleCleanupJobs(): Promise<void> {
    const executionRetention = parseInt(
      this.configService.get<string>('EXECUTION_RETENTION_DAYS') ?? '90',
      10,
    );
    const auditRetention = parseInt(
      this.configService.get<string>('AUDIT_RETENTION_DAYS') ?? '180',
      10,
    );
    const notificationRetention = parseInt(
      this.configService.get<string>('NOTIFICATION_RETENTION_DAYS') ?? '30',
      10,
    );

    await this.cleanupQueue.add(
      EXECUTION_CLEANUP_JOB,
      { retentionDays: executionRetention },
      {
        repeat: { pattern: '0 3 * * *' }, // Daily at 3 AM
        removeOnComplete: 10,
        removeOnFail: 50,
      },
    );

    await this.cleanupQueue.add(
      AUDIT_CLEANUP_JOB,
      { retentionDays: auditRetention },
      {
        repeat: { pattern: '0 4 * * *' }, // Daily at 4 AM
        removeOnComplete: 10,
        removeOnFail: 50,
      },
    );

    await this.cleanupQueue.add(
      NOTIFICATION_CLEANUP_JOB,
      { retentionDays: notificationRetention },
      {
        repeat: { pattern: '0 5 * * *' }, // Daily at 5 AM
        removeOnComplete: 10,
        removeOnFail: 50,
      },
    );

    await this.cleanupQueue.add(
      REFRESH_TOKEN_CLEANUP_JOB,
      { retentionDays: 30 },
      {
        repeat: { pattern: '0 2 * * *' }, // Daily at 2 AM
        removeOnComplete: 10,
        removeOnFail: 50,
      },
    );

    this.logger.log(
      `Scheduled cleanup jobs — executions: ${executionRetention}d, audit: ${auditRetention}d, notifications: ${notificationRetention}d, refresh tokens: 30d`,
    );
  }
}
