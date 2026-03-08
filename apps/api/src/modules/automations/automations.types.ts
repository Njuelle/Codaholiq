import { automations, automationVariables } from './automations.schema';

export type AutomationWithVariables = typeof automations.$inferSelect & {
  variables: (typeof automationVariables.$inferSelect)[];
};

export interface CostLimitStatus {
  readonly isCostLimitExceeded: boolean;
  readonly currentMonthCostMicros: number;
}

export type AutomationWithCostStatus = typeof automations.$inferSelect & {
  costLimitStatus: CostLimitStatus | null;
};

export type AutomationDetailWithCostStatus = AutomationWithVariables & {
  costLimitStatus: CostLimitStatus | null;
};
