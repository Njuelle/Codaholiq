export type ExecutionStatus =
  | 'pending'
  | 'dispatching'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface Execution {
  readonly id: number;
  readonly automationId: number;
  readonly status: ExecutionStatus;
  readonly triggerEvent: unknown;
  readonly resolvedPrompt: string;
  readonly provider: string | null;
  readonly model: string | null;
  readonly githubRunId: number | null;
  readonly githubRunUrl: string | null;
  readonly errorMessage: string | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly totalCostMicros: number | null;
  readonly costCurrency: string | null;
  readonly costReportedAt: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly createdAt: string;
}

export interface ExecutionWithAutomation {
  readonly execution: Execution;
  readonly automationName: string;
}

export interface ExecutionLog {
  readonly id: number;
  readonly executionId: number;
  readonly level: LogLevel;
  readonly message: string;
  readonly metadata: unknown;
  readonly timestamp: string;
}
