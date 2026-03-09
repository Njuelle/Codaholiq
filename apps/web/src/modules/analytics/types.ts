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

export type DateRangePreset = '7d' | '30d' | '90d' | 'custom';

export interface DateRange {
  readonly from: Date;
  readonly to: Date;
}
