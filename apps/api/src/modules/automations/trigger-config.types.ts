export interface EventTriggerConfig {
  readonly events: string[];
}

export interface CronTriggerConfig {
  readonly schedule: string;
  readonly timezone?: string;
}

export type ManualTriggerConfig = Record<string, unknown>;

export type TriggerConfig = EventTriggerConfig | CronTriggerConfig | ManualTriggerConfig;

export function asCronConfig(config: Record<string, unknown>): CronTriggerConfig {
  return config as unknown as CronTriggerConfig;
}

export function asEventConfig(config: Record<string, unknown>): EventTriggerConfig {
  return config as unknown as EventTriggerConfig;
}
