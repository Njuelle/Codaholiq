import cronstrue from 'cronstrue';

/** Full date with time: "Jan 1, 2025, 09:00 AM" */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Date only: "Jan 1, 2025" */
export function formatShortDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Compact date with time, no year: "Jan 1, 09:00 AM" */
export function formatCompactDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Cron expression to human-readable string. Returns `fallback` (or the raw expression) on parse error. */
export function formatCronExpression(expression: string, fallback?: string): string {
  try {
    return cronstrue.toString(expression);
  } catch {
    return fallback ?? expression;
  }
}

/** Format milliseconds to human-readable duration: "2m 34s", "< 1s", "1h 12m" */
export function formatDuration(ms: number): string {
  if (ms <= 0) return '-';
  if (ms < 1000) return '< 1s';

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  return `${seconds}s`;
}

/** Compute duration in ms between two ISO date strings. Returns null if either is missing or invalid. */
export function computeDurationMs({
  startedAt,
  completedAt,
}: {
  readonly startedAt: string | null;
  readonly completedAt: string | null;
}): number | null {
  if (!startedAt || !completedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return end - start;
}

/** Relative time from now: "2 minutes ago", "just now" */
export function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;

  return formatShortDate(dateString);
}
