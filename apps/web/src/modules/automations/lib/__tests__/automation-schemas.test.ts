import { automationFormSchema, DEFAULT_FORM_VALUES } from '../automation-schemas';

describe('automationFormSchema', () => {
  it('should validate a valid event automation', () => {
    const result = automationFormSchema.safeParse({
      ...DEFAULT_FORM_VALUES,
      name: 'Test Automation',
      repoId: 1,
      promptTemplate: 'Fix {{file}}',
      triggerType: 'event',
      triggerConfig: { events: ['push'] },
    });

    expect(result.success).toBe(true);
  });

  it('should validate a valid cron automation', () => {
    const result = automationFormSchema.safeParse({
      ...DEFAULT_FORM_VALUES,
      name: 'Cron Automation',
      repoId: 1,
      promptTemplate: 'Run daily check',
      triggerType: 'cron',
      triggerConfig: { schedule: '0 9 * * *' },
    });

    expect(result.success).toBe(true);
  });

  it('should validate a valid manual automation', () => {
    const result = automationFormSchema.safeParse({
      ...DEFAULT_FORM_VALUES,
      name: 'Manual Automation',
      repoId: 1,
      promptTemplate: 'Do something',
      triggerType: 'manual',
      triggerConfig: {},
    });

    expect(result.success).toBe(true);
  });

  it('should reject missing name', () => {
    const result = automationFormSchema.safeParse({
      ...DEFAULT_FORM_VALUES,
      name: '',
      repoId: 1,
      promptTemplate: 'Fix something',
      triggerType: 'event',
      triggerConfig: { events: ['push'] },
    });

    expect(result.success).toBe(false);
  });

  it('should reject event trigger with no events', () => {
    const result = automationFormSchema.safeParse({
      ...DEFAULT_FORM_VALUES,
      name: 'Test',
      repoId: 1,
      promptTemplate: 'Fix something',
      triggerType: 'event',
      triggerConfig: { events: [] },
    });

    expect(result.success).toBe(false);
  });

  it('should reject invalid cron expression', () => {
    const result = automationFormSchema.safeParse({
      ...DEFAULT_FORM_VALUES,
      name: 'Test',
      repoId: 1,
      promptTemplate: 'Fix something',
      triggerType: 'cron',
      triggerConfig: { schedule: 'not-a-cron' },
    });

    expect(result.success).toBe(false);
  });

  it('should reject invalid repoId', () => {
    const result = automationFormSchema.safeParse({
      ...DEFAULT_FORM_VALUES,
      name: 'Test',
      repoId: 0,
      promptTemplate: 'Fix something',
      triggerType: 'event',
      triggerConfig: { events: ['push'] },
    });

    expect(result.success).toBe(false);
  });

  it('should accept variables with valid structure', () => {
    const result = automationFormSchema.safeParse({
      ...DEFAULT_FORM_VALUES,
      name: 'Test',
      repoId: 1,
      promptTemplate: 'Fix {{file}}',
      triggerType: 'event',
      triggerConfig: { events: ['push'] },
      variables: [
        { key: 'file', value: 'src/main.ts', source: 'static', required: true },
        { key: 'branch', value: '', source: 'event_payload', required: false },
      ],
    });

    expect(result.success).toBe(true);
  });
});
