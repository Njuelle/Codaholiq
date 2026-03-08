import type { ExecutionStatus } from '@/common/types';

/** Statuses that indicate an execution is no longer running. */
export const TERMINAL_STATUSES: ReadonlySet<ExecutionStatus> = new Set([
  'completed',
  'failed',
  'cancelled',
  'timed_out',
  'cost_blocked',
]);

/** Returns true if the given URL is a valid GitHub URL (https only). */
export function isValidGitHubUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'github.com';
  } catch {
    return false;
  }
}
