import { Injectable, Inject } from '@nestjs/common';
import { ExecutionsService } from '../executions/executions.service';

export interface CostOverTimePoint {
  readonly date: string;
  readonly totalCostMicros: number;
  readonly totalInputTokens: number;
  readonly totalOutputTokens: number;
  readonly executionCount: number;
}

export interface CostSummary {
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

export interface AnalyticsData {
  readonly series: readonly CostOverTimePoint[];
  readonly summary: CostSummary;
  readonly costByProvider: readonly ProviderCostBreakdown[];
  readonly topCostliestAutomations: readonly AutomationCostBreakdown[];
}

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(ExecutionsService)
    private readonly executionsService: ExecutionsService,
  ) {}

  async getCostAnalytics({
    orgId,
    from,
    to,
    repoId,
  }: {
    orgId: number;
    from: Date;
    to: Date;
    repoId?: number;
  }): Promise<AnalyticsData> {
    const [series, costStats, costByProvider, topCostliestAutomations] = await Promise.all([
      this.executionsService.getCostOverTime({ orgId, from, to, repoId }),
      this.executionsService.getCostStats({ orgId, since: from, repoId }),
      this.executionsService.getCostByProvider({ orgId, since: from, repoId }),
      this.executionsService.getTopCostliestAutomations({ orgId, since: from, limit: 10, repoId }),
    ]);

    return {
      series,
      summary: {
        ...costStats,
        averageCostMicros:
          costStats.executionsWithCost > 0
            ? Math.round(costStats.totalCostMicros / costStats.executionsWithCost)
            : 0,
      },
      costByProvider,
      topCostliestAutomations,
    };
  }
}
