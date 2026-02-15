import type { ExecutionStatus } from '@/modules/executions/types';

export interface StatusCounts {
  readonly total: number;
  readonly completed: number;
  readonly failed: number;
  readonly running: number;
}

export interface ExecutionSummary {
  readonly execution: {
    readonly id: number;
    readonly status: ExecutionStatus;
    readonly createdAt: string;
  };
  readonly automationName: string;
}

export interface UpcomingCronTrigger {
  readonly automationId: number;
  readonly automationName: string;
  readonly nextFireAt: string;
}

export interface DashboardStats {
  readonly recentExecutions: readonly ExecutionSummary[];
  readonly executionStats: {
    readonly last24h: StatusCounts;
    readonly last7d: StatusCounts;
    readonly last30d: StatusCounts;
  };
  readonly activeAutomationsCount: number;
  readonly repositoryCount: number;
  readonly upcomingCronTriggers: readonly UpcomingCronTrigger[];
}
