import {
  EventTriggerConfigSchema,
  CronTriggerConfigSchema,
  ManualTriggerConfigSchema,
} from '../trigger-config.dto';

describe('EventTriggerConfigSchema', () => {
  it('should accept a single valid event', () => {
    const result = EventTriggerConfigSchema.safeParse({
      events: ['push'],
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ events: ['push'] });
  });

  it('should accept multiple valid events', () => {
    const result = EventTriggerConfigSchema.safeParse({
      events: ['push', 'pull_request', 'issues'],
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ events: ['push', 'pull_request', 'issues'] });
  });

  it('should reject an empty events array', () => {
    const result = EventTriggerConfigSchema.safeParse({
      events: [],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('At least one event is required');
  });

  it('should reject an empty string event name', () => {
    const result = EventTriggerConfigSchema.safeParse({
      events: [''],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Event name must not be empty');
  });
});

describe('CronTriggerConfigSchema', () => {
  it('should accept a valid 5-field cron expression', () => {
    const result = CronTriggerConfigSchema.safeParse({
      schedule: '0 9 * * 1-5',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ schedule: '0 9 * * 1-5' });
  });

  it('should accept a valid cron expression with timezone', () => {
    const result = CronTriggerConfigSchema.safeParse({
      schedule: '*/15 * * * *',
      timezone: 'America/New_York',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      schedule: '*/15 * * * *',
      timezone: 'America/New_York',
    });
  });

  it('should reject an empty schedule', () => {
    const result = CronTriggerConfigSchema.safeParse({
      schedule: '',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Schedule is required');
  });

  it('should reject an invalid cron expression', () => {
    const result = CronTriggerConfigSchema.safeParse({
      schedule: 'not-a-cron',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Invalid cron expression');
  });
});

describe('ManualTriggerConfigSchema', () => {
  it('should accept an empty object', () => {
    const result = ManualTriggerConfigSchema.safeParse({});

    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
  });
});
