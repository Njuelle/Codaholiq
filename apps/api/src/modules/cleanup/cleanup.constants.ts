export const CLEANUP_QUEUE = 'cleanup';

export const EXECUTION_CLEANUP_JOB = 'execution-cleanup';
export const AUDIT_CLEANUP_JOB = 'audit-cleanup';
export const NOTIFICATION_CLEANUP_JOB = 'notification-cleanup';
export const REFRESH_TOKEN_CLEANUP_JOB = 'refresh-token-cleanup';

export interface CleanupJobData {
  readonly retentionDays: number;
}
