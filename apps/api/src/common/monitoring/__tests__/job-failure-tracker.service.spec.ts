import { JobFailureTrackerService } from '../job-failure-tracker.service';

describe('JobFailureTrackerService', () => {
  let service: JobFailureTrackerService;

  beforeEach(() => {
    service = new JobFailureTrackerService();
  });

  it('should track a single failure', () => {
    service.trackFailure({ jobType: 'webhook', error: new Error('fail') });
    expect(service.getFailureCount({ jobType: 'webhook' })).toBe(1);
  });

  it('should track multiple failures for same job type', () => {
    service.trackFailure({ jobType: 'webhook', error: new Error('fail 1') });
    service.trackFailure({ jobType: 'webhook', error: new Error('fail 2') });
    service.trackFailure({ jobType: 'webhook', error: new Error('fail 3') });
    expect(service.getFailureCount({ jobType: 'webhook' })).toBe(3);
  });

  it('should track failures independently per job type', () => {
    service.trackFailure({ jobType: 'webhook', error: new Error('fail') });
    service.trackFailure({ jobType: 'execution', error: new Error('fail') });
    expect(service.getFailureCount({ jobType: 'webhook' })).toBe(1);
    expect(service.getFailureCount({ jobType: 'execution' })).toBe(1);
  });

  it('should return 0 for unknown job types', () => {
    expect(service.getFailureCount({ jobType: 'unknown' })).toBe(0);
  });

  it('should expire old failures outside the window', () => {
    vi.useFakeTimers();
    try {
      service.trackFailure({ jobType: 'webhook', error: new Error('old') });
      expect(service.getFailureCount({ jobType: 'webhook' })).toBe(1);

      // Advance past the 10-minute window
      vi.advanceTimersByTime(11 * 60 * 1000);

      expect(service.getFailureCount({ jobType: 'webhook' })).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('should reset all tracked failures', () => {
    service.trackFailure({ jobType: 'webhook', error: new Error('fail') });
    service.trackFailure({ jobType: 'execution', error: new Error('fail') });
    service.reset();
    expect(service.getFailureCount({ jobType: 'webhook' })).toBe(0);
    expect(service.getFailureCount({ jobType: 'execution' })).toBe(0);
  });

  it('should handle non-Error exceptions', () => {
    service.trackFailure({ jobType: 'webhook', error: 'string error' });
    expect(service.getFailureCount({ jobType: 'webhook' })).toBe(1);
  });
});
