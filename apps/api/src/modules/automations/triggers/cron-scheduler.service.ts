import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CRON_TRIGGER_QUEUE } from '../automations.constants';
import { AutomationRepository } from '../automations.repository';

@Injectable()
export class CronSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(CronSchedulerService.name);

  constructor(
    @Inject(AutomationRepository)
    private readonly automationRepository: AutomationRepository,
    @InjectQueue(CRON_TRIGGER_QUEUE)
    private readonly cronQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.syncAllCrons();
    } catch (error) {
      this.logger.error(
        `Failed to sync cron jobs on startup: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async registerCron({
    automationId,
    schedule,
    timezone,
  }: {
    automationId: number;
    schedule: string;
    timezone?: string;
  }): Promise<void> {
    await this.cronQueue.add(
      `cron:${automationId}`,
      { automationId },
      {
        repeat: {
          pattern: schedule,
          ...(timezone ? { tz: timezone } : {}),
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );

    this.logger.log(`Registered cron for automation ${automationId}: ${schedule}`);
  }

  async unregisterCron({ automationId }: { automationId: number }): Promise<void> {
    const repeatables = await this.cronQueue.getRepeatableJobs();
    const job = repeatables.find((r) => r.name === `cron:${automationId}`);

    if (job) {
      await this.cronQueue.removeRepeatableByKey(job.key);
      this.logger.log(`Unregistered cron for automation ${automationId}`);
    }
  }

  async updateCron({
    automationId,
    schedule,
    timezone,
  }: {
    automationId: number;
    schedule: string;
    timezone?: string;
  }): Promise<void> {
    await this.unregisterCron({ automationId });
    await this.registerCron({ automationId, schedule, timezone });
  }

  async syncAllCrons(): Promise<void> {
    const cronAutomations = await this.automationRepository.findCronAutomations();
    const repeatableJobs = await this.cronQueue.getRepeatableJobs();

    const dbAutomationIds = new Set(cronAutomations.map((a) => a.id));
    const activeJobNames = new Map(repeatableJobs.map((j) => [j.name, j]));

    // Add missing cron jobs (in DB but not in BullMQ)
    for (const automation of cronAutomations) {
      const jobName = `cron:${automation.id}`;
      if (!activeJobNames.has(jobName)) {
        const config = automation.triggerConfig as {
          schedule: string;
          timezone?: string;
        };
        await this.registerCron({
          automationId: automation.id,
          schedule: config.schedule,
          timezone: config.timezone,
        });
      }
    }

    // Remove stale cron jobs (in BullMQ but not in DB)
    for (const [jobName, job] of activeJobNames) {
      if (!jobName.startsWith('cron:')) continue;
      const automationId = parseInt(jobName.split(':')[1], 10);
      if (!dbAutomationIds.has(automationId)) {
        await this.cronQueue.removeRepeatableByKey(job.key);
        this.logger.log(`Removed stale cron job for automation ${automationId}`);
      }
    }

    this.logger.log(`Cron sync complete: ${cronAutomations.length} active cron automation(s)`);
  }
}
