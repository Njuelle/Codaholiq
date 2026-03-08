import type { JobsOptions } from 'bullmq';

export const EXECUTION_QUEUE = 'execution';

export const DISPATCH_JOB = 'dispatch';
export const POLL_STATUS_JOB = 'poll-status';
export const COLLECT_LOGS_JOB = 'collect-logs';

export const TERMINAL_STATUSES = new Set([
  'completed',
  'failed',
  'cancelled',
  'timed_out',
  'cost_blocked',
]);

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

export function mapConclusion(
  conclusion: string | null,
): 'completed' | 'failed' | 'cancelled' | 'timed_out' {
  switch (conclusion) {
    case 'success':
      return 'completed';
    case 'failure':
    case 'startup_failure':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    case 'timed_out':
      return 'timed_out';
    default:
      return 'failed';
  }
}

export interface DispatchJobData {
  readonly executionId: number;
  readonly automationId: number;
  readonly automationName: string;
  readonly installationId: number; // GitHub App installation ID
  readonly owner: string;
  readonly repo: string;
  readonly workflowFile: string;
  readonly ref: string;
  readonly provider: string;
  readonly model?: string;
  // resolvedPrompt intentionally excluded — fetched from DB inside processor
  // to avoid storing sensitive prompt data in Redis (SEC-002)
}

export interface PollStatusJobData {
  readonly executionId: number;
  readonly githubRunId: number;
  readonly installationId: number;
  readonly owner: string;
  readonly repo: string;
  readonly dispatchedAt: string; // ISO string — used for 2h timeout check
}

export interface CollectLogsJobData {
  readonly executionId: number;
  readonly githubRunId: number;
  readonly installationId: number;
  readonly owner: string;
  readonly repo: string;
  readonly provider?: string;
}
