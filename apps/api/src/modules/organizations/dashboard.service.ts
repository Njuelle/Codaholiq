import { Injectable, Inject, Logger } from '@nestjs/common';
import { CronExpressionParser } from 'cron-parser';
import { ExecutionsService } from '../executions/executions.service';
import { AutomationService } from '../automations/automations.service';
import { RepositoriesService } from '../github/repositories.service';

interface StatusCounts {
  total: number;
  completed: number;
  failed: number;
  running: number;
}

interface UpcomingCronTrigger {
  automationId: number;
  automationName: string;
  nextFireAt: string;
}

export interface DashboardStats {
  recentExecutions: {
    execution: { id: number; status: string; createdAt: Date };
    automationName: string;
  }[];
  executionStats: {
    last24h: StatusCounts;
    last7d: StatusCounts;
    last30d: StatusCounts;
  };
  activeAutomationsCount: number;
  repositoryCount: number;
  upcomingCronTriggers: UpcomingCronTrigger[];
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @Inject(ExecutionsService)
    private readonly executionsService: ExecutionsService,
    @Inject(AutomationService)
    private readonly automationService: AutomationService,
    @Inject(RepositoriesService)
    private readonly repositoriesService: RepositoriesService,
  ) {}

  async getStats({ orgId }: { orgId: number }): Promise<DashboardStats> {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      recentExecutions,
      stats24h,
      stats7d,
      stats30d,
      activeAutomationsCount,
      repositoryCount,
      cronAutomations,
    ] = await Promise.all([
      this.executionsService.listRecent({ orgId, limit: 10 }),
      this.executionsService.countByStatusInDateRange({ orgId, since: last24h }),
      this.executionsService.countByStatusInDateRange({ orgId, since: last7d }),
      this.executionsService.countByStatusInDateRange({ orgId, since: last30d }),
      this.automationService.countByOrgId({ orgId, enabled: true }),
      this.repositoriesService.countByOrgId({ orgId }),
      this.automationService.findCronAutomationsByOrgId({ orgId }),
    ]);

    const upcomingCronTriggers = this.computeUpcomingCrons(cronAutomations);

    return {
      recentExecutions,
      executionStats: {
        last24h: this.aggregateStatusCounts(stats24h),
        last7d: this.aggregateStatusCounts(stats7d),
        last30d: this.aggregateStatusCounts(stats30d),
      },
      activeAutomationsCount,
      repositoryCount,
      upcomingCronTriggers,
    };
  }

  private aggregateStatusCounts(rows: { status: string; count: number }[]): StatusCounts {
    const counts: StatusCounts = {
      total: 0,
      completed: 0,
      failed: 0,
      running: 0,
    };

    for (const row of rows) {
      counts.total += row.count;
      if (row.status === 'completed') counts.completed = row.count;
      if (row.status === 'failed') counts.failed = row.count;
      if (row.status === 'running') counts.running = row.count;
    }

    return counts;
  }

  private computeUpcomingCrons(
    automations: { id: number; name: string; triggerConfig: unknown }[],
  ): UpcomingCronTrigger[] {
    const TOP_K = 5;
    const top: UpcomingCronTrigger[] = [];

    for (const automation of automations) {
      const config = automation.triggerConfig as {
        schedule?: string;
        timezone?: string;
      } | null;

      if (!config?.schedule) continue;

      try {
        const interval = CronExpressionParser.parse(config.schedule, {
          tz: config.timezone,
          currentDate: new Date(),
        });
        const next = interval.next();
        const nextFireAt = next.toDate().toISOString();

        const lastEntry = top[top.length - 1];
        if (top.length < TOP_K || (lastEntry && nextFireAt < lastEntry.nextFireAt)) {
          top.push({
            automationId: automation.id,
            automationName: automation.name,
            nextFireAt,
          });
          top.sort((a, b) => a.nextFireAt.localeCompare(b.nextFireAt));
          if (top.length > TOP_K) top.pop();
        }
      } catch (error) {
        this.logger.warn(
          `Invalid cron expression for automation ${automation.id}: ${config.schedule}`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    return top;
  }
}
