import { AutomationCreateSchema } from '../create-automation.dto';

const validBase = {
  name: 'Deploy on push',
  repoId: 1,
  promptTemplate: 'Run deploy script',
  provider: 'claude-code',
};

describe('AutomationCreateSchema', () => {
  it('should accept a valid event automation', () => {
    const result = AutomationCreateSchema.safeParse({
      ...validBase,
      triggerType: 'event',
      triggerConfig: { events: ['push'] },
    });

    expect(result.success).toBe(true);
    expect(result.data?.triggerType).toBe('event');
    expect(result.data?.enabled).toBe(true);
    expect(result.data?.variables).toEqual([]);
  });

  it('should accept a valid cron automation', () => {
    const result = AutomationCreateSchema.safeParse({
      ...validBase,
      triggerType: 'cron',
      triggerConfig: { schedule: '0 9 * * 1-5' },
    });

    expect(result.success).toBe(true);
    expect(result.data?.triggerType).toBe('cron');
  });

  it('should accept a valid manual automation', () => {
    const result = AutomationCreateSchema.safeParse({
      ...validBase,
      triggerType: 'manual',
      triggerConfig: {},
    });

    expect(result.success).toBe(true);
    expect(result.data?.triggerType).toBe('manual');
  });

  it('should reject a missing name', () => {
    const { name: _, ...withoutName } = validBase;
    const result = AutomationCreateSchema.safeParse({
      ...withoutName,
      triggerType: 'manual',
      triggerConfig: {},
    });

    expect(result.success).toBe(false);
  });

  it('should reject a name longer than 255 characters', () => {
    const result = AutomationCreateSchema.safeParse({
      ...validBase,
      name: 'a'.repeat(256),
      triggerType: 'manual',
      triggerConfig: {},
    });

    expect(result.success).toBe(false);
  });

  it('should reject a negative repoId', () => {
    const result = AutomationCreateSchema.safeParse({
      ...validBase,
      repoId: -1,
      triggerType: 'manual',
      triggerConfig: {},
    });

    expect(result.success).toBe(false);
  });

  it('should reject missing triggerConfig for event type', () => {
    const result = AutomationCreateSchema.safeParse({
      ...validBase,
      triggerType: 'event',
    });

    expect(result.success).toBe(false);
  });

  it('should accept an automation with variables', () => {
    const result = AutomationCreateSchema.safeParse({
      ...validBase,
      triggerType: 'manual',
      triggerConfig: {},
      variables: [
        { key: 'API_KEY', value: 'secret-123', source: 'static' },
        { key: 'BRANCH', value: 'main', source: 'static', required: true },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.data?.variables).toHaveLength(2);
  });

  it('should reject a variable with an empty key', () => {
    const result = AutomationCreateSchema.safeParse({
      ...validBase,
      triggerType: 'manual',
      triggerConfig: {},
      variables: [{ key: '', value: 'val', source: 'static' }],
    });

    expect(result.success).toBe(false);
  });

  // ── Condition groups ────────────────────────────────────────────

  it('should accept event trigger config with conditionGroups', () => {
    const result = AutomationCreateSchema.safeParse({
      ...validBase,
      triggerType: 'event',
      triggerConfig: {
        events: ['issues.labeled'],
        conditionGroups: [
          {
            conditions: [{ path: 'label.name', operator: 'equals', value: 'bug' }],
          },
        ],
      },
    });

    expect(result.success).toBe(true);
  });

  it('should accept event trigger config without conditionGroups (backward compat)', () => {
    const result = AutomationCreateSchema.safeParse({
      ...validBase,
      triggerType: 'event',
      triggerConfig: { events: ['push'] },
    });

    expect(result.success).toBe(true);
  });

  it('should reject more than 5 condition groups', () => {
    const groups = Array.from({ length: 6 }, () => ({
      conditions: [{ path: 'ref', operator: 'equals', value: 'main' }],
    }));
    const result = AutomationCreateSchema.safeParse({
      ...validBase,
      triggerType: 'event',
      triggerConfig: { events: ['push'], conditionGroups: groups },
    });

    expect(result.success).toBe(false);
  });

  it('should reject more than 10 conditions per group', () => {
    const conditions = Array.from({ length: 11 }, (_, i) => ({
      path: `field${i}`,
      operator: 'equals',
      value: 'val',
    }));
    const result = AutomationCreateSchema.safeParse({
      ...validBase,
      triggerType: 'event',
      triggerConfig: {
        events: ['push'],
        conditionGroups: [{ conditions }],
      },
    });

    expect(result.success).toBe(false);
  });

  it('should reject condition with empty path', () => {
    const result = AutomationCreateSchema.safeParse({
      ...validBase,
      triggerType: 'event',
      triggerConfig: {
        events: ['push'],
        conditionGroups: [
          {
            conditions: [{ path: '', operator: 'equals', value: 'main' }],
          },
        ],
      },
    });

    expect(result.success).toBe(false);
  });

  it('should require value for non-existence operators', () => {
    const result = AutomationCreateSchema.safeParse({
      ...validBase,
      triggerType: 'event',
      triggerConfig: {
        events: ['push'],
        conditionGroups: [
          {
            conditions: [{ path: 'ref', operator: 'equals' }],
          },
        ],
      },
    });

    expect(result.success).toBe(false);
  });

  it('should not require value for exists operator', () => {
    const result = AutomationCreateSchema.safeParse({
      ...validBase,
      triggerType: 'event',
      triggerConfig: {
        events: ['pull_request.opened'],
        conditionGroups: [
          {
            conditions: [{ path: 'issue.pull_request', operator: 'exists' }],
          },
        ],
      },
    });

    expect(result.success).toBe(true);
  });

  it('should not require value for not_exists operator', () => {
    const result = AutomationCreateSchema.safeParse({
      ...validBase,
      triggerType: 'event',
      triggerConfig: {
        events: ['issue_comment.created'],
        conditionGroups: [
          {
            conditions: [{ path: 'issue.pull_request', operator: 'not_exists' }],
          },
        ],
      },
    });

    expect(result.success).toBe(true);
  });

  it('should accept multiple condition groups (OR logic)', () => {
    const result = AutomationCreateSchema.safeParse({
      ...validBase,
      triggerType: 'event',
      triggerConfig: {
        events: ['push'],
        conditionGroups: [
          {
            conditions: [{ path: 'ref', operator: 'equals', value: 'refs/heads/main' }],
          },
          {
            conditions: [{ path: 'ref', operator: 'starts_with', value: 'refs/heads/release/' }],
          },
        ],
      },
    });

    expect(result.success).toBe(true);
  });
});
