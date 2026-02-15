import { AutomationUpdateSchema } from '../update-automation.dto';

describe('AutomationUpdateSchema', () => {
  it('should accept a partial update with only name', () => {
    const result = AutomationUpdateSchema.safeParse({
      name: 'Updated name',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'Updated name' });
  });

  it('should accept a full update with all fields', () => {
    const result = AutomationUpdateSchema.safeParse({
      name: 'Full update',
      description: 'A description',
      triggerType: 'cron',
      triggerConfig: { schedule: '0 0 * * *' },
      promptTemplate: 'Updated prompt',
      enabled: false,
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      name: 'Full update',
      description: 'A description',
      triggerType: 'cron',
      triggerConfig: { schedule: '0 0 * * *' },
      promptTemplate: 'Updated prompt',
      enabled: false,
    });
  });

  it('should accept an empty object (no fields to update)', () => {
    const result = AutomationUpdateSchema.safeParse({});

    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
  });

  it('should reject triggerType without triggerConfig', () => {
    const result = AutomationUpdateSchema.safeParse({
      triggerType: 'event',
    });

    expect(result.success).toBe(false);
  });

  it('should accept triggerConfig together with triggerType', () => {
    const result = AutomationUpdateSchema.safeParse({
      triggerType: 'event',
      triggerConfig: { events: ['push'] },
    });

    expect(result.success).toBe(true);
    expect(result.data?.triggerType).toBe('event');
  });

  it('should reject mismatched triggerType and triggerConfig', () => {
    const result = AutomationUpdateSchema.safeParse({
      triggerType: 'event',
      triggerConfig: { schedule: '0 * * * *' },
    });

    expect(result.success).toBe(false);
  });

  it('should reject cron triggerType with event triggerConfig', () => {
    const result = AutomationUpdateSchema.safeParse({
      triggerType: 'cron',
      triggerConfig: { events: ['push'] },
    });

    expect(result.success).toBe(false);
  });

  it('should accept event trigger config with conditionGroups', () => {
    const result = AutomationUpdateSchema.safeParse({
      triggerType: 'event',
      triggerConfig: {
        events: ['push'],
        conditionGroups: [
          {
            conditions: [{ path: 'ref', operator: 'equals', value: 'refs/heads/main' }],
          },
        ],
      },
    });

    expect(result.success).toBe(true);
  });

  it('should accept event trigger config without conditionGroups', () => {
    const result = AutomationUpdateSchema.safeParse({
      triggerType: 'event',
      triggerConfig: { events: ['push'] },
    });

    expect(result.success).toBe(true);
  });
});
