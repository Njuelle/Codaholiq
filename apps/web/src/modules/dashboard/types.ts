import type { ExecutionStatus } from '@/modules/executions/types';

export interface StatusCounts {
  readonly total: number;
  readonly completed: number;
  readonly failed: number;
  readonly running: number;
}

export interface CostStats {
  readonly totalCostMicros: number;
  readonly totalInputTokens: number;
  readonly totalOutputTokens: number;
  readonly executionsWithCost: number;
  readonly averageCostMicros: number;
}

export interface ProviderCostBreakdown {
  readonly provider: string;
  readonly model: string | null;
  readonly totalCostMicros: number;
  readonly count: number;
}

export interface AutomationCostBreakdown {
  readonly automationId: number;
  readonly automationName: string;
  readonly totalCostMicros: number;
  readonly executionCount: number;
  readonly totalInputTokens: number;
  readonly totalOutputTokens: number;
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
  readonly costStats: {
    readonly last24h: CostStats;
    readonly last7d: CostStats;
    readonly last30d: CostStats;
  };
  readonly costByProvider: readonly ProviderCostBreakdown[];
  readonly topCostliestAutomations: readonly AutomationCostBreakdown[];
  readonly activeAutomationsCount: number;
  readonly repositoryCount: number;
  readonly upcomingCronTriggers: readonly UpcomingCronTrigger[];
}
