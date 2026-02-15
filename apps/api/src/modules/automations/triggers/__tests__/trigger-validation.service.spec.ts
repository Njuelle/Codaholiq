import { BadRequestException } from '@nestjs/common';
import { TriggerValidationService } from '../trigger-validation.service';

describe('TriggerValidationService', () => {
  let service: TriggerValidationService;

  beforeEach(() => {
    service = new TriggerValidationService();
  });

  describe('validateEventConfig', () => {
    it('should accept a single valid event', () => {
      expect(() =>
        service.validateEventConfig({
          config: { events: ['pull_request.opened'] },
        }),
      ).not.toThrow();
    });

    it('should accept multiple valid events', () => {
      expect(() =>
        service.validateEventConfig({
          config: {
            events: ['pull_request.opened', 'push', 'workflow_run.completed.failure'],
          },
        }),
      ).not.toThrow();
    });

    it('should accept all known event types', () => {
      const allEvents = [
        'pull_request.opened',
        'pull_request.closed',
        'pull_request.merged',
        'pull_request.synchronize',
        'push',
        'workflow_run.completed',
        'workflow_run.completed.failure',
        'workflow_run.completed.success',
        'check_run.completed.failure',
      ];
      expect(() => service.validateEventConfig({ config: { events: allEvents } })).not.toThrow();
    });

    it('should reject unknown event types', () => {
      expect(() =>
        service.validateEventConfig({
          config: { events: ['unknown.event'] },
        }),
      ).toThrow(BadRequestException);
    });

    it('should include unknown event name in error message', () => {
      expect(() =>
        service.validateEventConfig({
          config: { events: ['foo.bar', 'baz.qux'] },
        }),
      ).toThrow(/foo\.bar, baz\.qux/);
    });

    it('should reject when mix of valid and invalid events', () => {
      expect(() =>
        service.validateEventConfig({
          config: { events: ['push', 'invalid.event'] },
        }),
      ).toThrow(BadRequestException);
    });

    it('should accept valid conditions', () => {
      expect(() =>
        service.validateEventConfig({
          config: {
            events: ['push'],
            conditionGroups: [
              {
                conditions: [{ path: 'ref', operator: 'equals', value: 'refs/heads/main' }],
              },
            ],
          },
        }),
      ).not.toThrow();
    });

    it('should accept event config without conditionGroups', () => {
      expect(() =>
        service.validateEventConfig({
          config: { events: ['push'] },
        }),
      ).not.toThrow();
    });

    it('should reject condition paths with invalid characters', () => {
      expect(() =>
        service.validateEventConfig({
          config: {
            events: ['push'],
            conditionGroups: [
              {
                conditions: [{ path: 'ref[0]', operator: 'equals', value: 'val' }],
              },
            ],
          },
        }),
      ).toThrow(/Invalid condition path/);
    });

    it('should reject condition paths with spaces', () => {
      expect(() =>
        service.validateEventConfig({
          config: {
            events: ['push'],
            conditionGroups: [
              {
                conditions: [{ path: 'some path', operator: 'equals', value: 'val' }],
              },
            ],
          },
        }),
      ).toThrow(/Invalid condition path/);
    });

    it('should reject invalid regex patterns in matches operator', () => {
      expect(() =>
        service.validateEventConfig({
          config: {
            events: ['push'],
            conditionGroups: [
              {
                conditions: [{ path: 'ref', operator: 'matches', value: '[invalid(' }],
              },
            ],
          },
        }),
      ).toThrow(/Invalid regex pattern/);
    });

    it('should reject regex patterns exceeding 200 characters', () => {
      expect(() =>
        service.validateEventConfig({
          config: {
            events: ['push'],
            conditionGroups: [
              {
                conditions: [
                  {
                    path: 'ref',
                    operator: 'matches',
                    value: 'a'.repeat(201),
                  },
                ],
              },
            ],
          },
        }),
      ).toThrow(/must not exceed 200 characters/);
    });

    it('should reject regex patterns with nested quantifiers (ReDoS)', () => {
      expect(() =>
        service.validateEventConfig({
          config: {
            events: ['push'],
            conditionGroups: [
              {
                conditions: [{ path: 'ref', operator: 'matches', value: '(a+)+b' }],
              },
            ],
          },
        }),
      ).toThrow(/nested quantifiers/);
    });

    it('should reject regex pattern (a*)*', () => {
      expect(() =>
        service.validateEventConfig({
          config: {
            events: ['push'],
            conditionGroups: [
              {
                conditions: [{ path: 'ref', operator: 'matches', value: '(a*)*' }],
              },
            ],
          },
        }),
      ).toThrow(/nested quantifiers/);
    });

    it('should accept safe regex patterns', () => {
      expect(() =>
        service.validateEventConfig({
          config: {
            events: ['push'],
            conditionGroups: [
              {
                conditions: [
                  {
                    path: 'ref',
                    operator: 'matches',
                    value: '^refs/heads/(main|develop)$',
                  },
                ],
              },
            ],
          },
        }),
      ).not.toThrow();
    });
  });

  describe('validateCronConfig', () => {
    it('should accept a valid cron expression (every hour)', () => {
      expect(() =>
        service.validateCronConfig({
          config: { schedule: '0 * * * *' },
        }),
      ).not.toThrow();
    });

    it('should accept every 5 minutes', () => {
      expect(() =>
        service.validateCronConfig({
          config: { schedule: '*/5 * * * *' },
        }),
      ).not.toThrow();
    });

    it('should accept a daily cron', () => {
      expect(() =>
        service.validateCronConfig({
          config: { schedule: '0 9 * * 1-5' },
        }),
      ).not.toThrow();
    });

    it('should reject every minute (interval < 5 min)', () => {
      expect(() =>
        service.validateCronConfig({
          config: { schedule: '* * * * *' },
        }),
      ).toThrow('Cron schedule interval must be at least 5 minutes');
    });

    it('should reject every 4 minutes (interval < 5 min)', () => {
      expect(() =>
        service.validateCronConfig({
          config: { schedule: '*/4 * * * *' },
        }),
      ).toThrow('Cron schedule interval must be at least 5 minutes');
    });

    it('should reject every 2 minutes', () => {
      expect(() =>
        service.validateCronConfig({
          config: { schedule: '*/2 * * * *' },
        }),
      ).toThrow('Cron schedule interval must be at least 5 minutes');
    });

    it('should reject an invalid cron expression', () => {
      expect(() =>
        service.validateCronConfig({
          config: { schedule: 'not a cron' },
        }),
      ).toThrow(BadRequestException);
    });

    it('should accept a valid timezone', () => {
      expect(() =>
        service.validateCronConfig({
          config: { schedule: '0 * * * *', timezone: 'America/New_York' },
        }),
      ).not.toThrow();
    });

    it('should reject an invalid timezone', () => {
      expect(() =>
        service.validateCronConfig({
          config: { schedule: '0 * * * *', timezone: 'Invalid/Timezone' },
        }),
      ).toThrow('Invalid timezone: Invalid/Timezone');
    });

    it('should accept schedule without timezone', () => {
      expect(() =>
        service.validateCronConfig({
          config: { schedule: '0 12 * * *' },
        }),
      ).not.toThrow();
    });
  });

  describe('validateManualConfig', () => {
    it('should accept an empty object', () => {
      expect(() => service.validateManualConfig({ config: {} })).not.toThrow();
    });

    it('should reject a non-empty object', () => {
      expect(() =>
        service.validateManualConfig({
          config: { extra: 'field' } as Record<string, unknown>,
        }),
      ).toThrow('Manual trigger config must be an empty object');
    });

    it('should reject object with multiple keys', () => {
      expect(() =>
        service.validateManualConfig({
          config: { a: 1, b: 2 } as Record<string, unknown>,
        }),
      ).toThrow(BadRequestException);
    });
  });
});
