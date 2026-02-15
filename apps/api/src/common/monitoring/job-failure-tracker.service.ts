import { Injectable, Logger } from '@nestjs/common';

interface FailureRecord {
  readonly timestamps: number[];
}

const ALERT_THRESHOLD = 3;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const CONTROL_CHARS = /[\x00-\x1f\x7f]/g;

function sanitizeJobType(jobType: string): string {
  return jobType.replace(CONTROL_CHARS, '');
}

@Injectable()
export class JobFailureTrackerService {
  private readonly logger = new Logger(JobFailureTrackerService.name);
  private readonly failures = new Map<string, FailureRecord>();

  trackFailure({ jobType, error }: { jobType: string; error: unknown }): void {
    const safeJobType = sanitizeJobType(jobType);
    const now = Date.now();
    const record = this.failures.get(safeJobType) ?? { timestamps: [] };

    // Remove expired timestamps
    const recent = record.timestamps.filter((t) => now - t < WINDOW_MS);
    recent.push(now);

    this.failures.set(safeJobType, { timestamps: recent });

    if (recent.length >= ALERT_THRESHOLD) {
      this.logger.error(
        {
          jobType: safeJobType,
          failureCount: recent.length,
          windowMinutes: WINDOW_MS / 60000,
          latestError: error instanceof Error ? error.message : String(error),
        },
        `Job type "${safeJobType}" has failed ${recent.length} times in ${String(WINDOW_MS / 60000)} minutes`,
      );
    }
  }

  getFailureCount({ jobType }: { jobType: string }): number {
    const now = Date.now();
    const record = this.failures.get(jobType);
    if (!record) return 0;
    return record.timestamps.filter((t) => now - t < WINDOW_MS).length;
  }

  reset(): void {
    this.failures.clear();
  }
}
