export type TriggerType = 'event' | 'cron' | 'manual';
export type VariableSource = 'static' | 'event_payload';

export interface AutomationVariable {
  readonly id: number;
  readonly automationId: number;
  readonly key: string;
  readonly value: string;
  readonly source: VariableSource;
  readonly required: boolean;
  readonly createdAt: string;
}

export interface CostLimitStatus {
  readonly isCostLimitExceeded: boolean;
  readonly currentMonthCostMicros: number;
}

export interface Automation {
  readonly id: number;
  readonly orgId: number;
  readonly repoId: number;
  readonly name: string;
  readonly description: string | null;
  readonly triggerType: TriggerType;
  readonly triggerConfig: EventTriggerConfig | CronTriggerConfig | ManualTriggerConfig;
  readonly promptTemplate: string;
  readonly provider: string;
  readonly model: string | null;
  readonly workflowFile: string;
  readonly enabled: boolean;
  readonly monthlyCostLimitMicros: number | null;
  readonly costLimitStatus: CostLimitStatus | null;
  readonly createdBy: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ClaudeModel {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

export interface ProviderModel {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly requiredSecret?: string;
}

export interface SecretRequirement {
  readonly name: string;
  readonly required: boolean;
  readonly description: string;
}

export interface ProviderDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly models: readonly ProviderModel[];
  readonly defaultModelId: string;
  readonly secrets: readonly SecretRequirement[];
}

export interface ProviderListResponse {
  readonly providers: readonly ProviderDefinition[];
  readonly defaultProviderId: string;
}

export interface ProviderSecretStatus {
  readonly providerId: string;
  readonly providerName: string;
  readonly configured: boolean;
  readonly secrets: readonly { readonly name: string; readonly exists: boolean }[];
}

export interface AutomationWithVariables extends Automation {
  readonly variables: readonly AutomationVariable[];
}

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'matches'
  | 'exists'
  | 'not_exists';

export interface TriggerCondition {
  readonly path: string;
  readonly operator: ConditionOperator;
  readonly value?: string;
}

export interface ConditionGroup {
  readonly conditions: readonly TriggerCondition[];
}

export interface EventTriggerConfig {
  readonly events: readonly string[];
  readonly conditionGroups?: readonly ConditionGroup[];
}

export interface CronTriggerConfig {
  readonly schedule: string;
  readonly timezone?: string;
}

export type ManualTriggerConfig = Record<string, never>;

export interface AutomationVariableInput {
  readonly key: string;
  readonly value: string;
  readonly source: VariableSource;
  readonly required: boolean;
}

export interface ValidatePromptResponse {
  readonly resolvedPrompt: string;
  readonly variables: readonly string[];
}

export interface ManualTriggerResponse {
  readonly executionId: number;
  readonly status: string;
}

export interface AutomationListFilters {
  readonly triggerType?: TriggerType;
  readonly enabled?: boolean;
  readonly repoId?: number;
  readonly limit?: number;
  readonly offset?: number;
}

export interface CatalogVariable {
  readonly key: string;
  readonly value: string;
  readonly source: VariableSource;
  readonly required: boolean;
}

export interface CatalogTemplate {
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly icon: string;
  readonly triggerType: TriggerType;
  readonly triggerConfig: EventTriggerConfig | CronTriggerConfig | ManualTriggerConfig;
  readonly promptTemplate: string;
  readonly provider: string;
  readonly model: string | null;
  readonly variables: readonly CatalogVariable[];
}

export interface CatalogCategory {
  readonly name: string;
  readonly templates: readonly CatalogTemplate[];
}

export interface CatalogResponse {
  readonly categories: readonly CatalogCategory[];
}

export interface CreateFromTemplateInput {
  readonly templateSlug: string;
  readonly repoId: number;
  readonly provider?: string;
  readonly model?: string | null;
}
