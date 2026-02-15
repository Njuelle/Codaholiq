import type { GitHubEventDefinition } from '@/modules/automations/hooks/use-github-events';
import { getAvailableVariables, type VariableGroup } from '../variable-catalog';

const MOCK_EVENTS: readonly GitHubEventDefinition[] = [
  {
    event: 'push',
    description: 'One or more commits pushed',
    category: 'code_and_commits',
    actions: [],
    payloadPaths: [
      { path: 'ref', description: 'Branch or tag ref' },
      { path: 'pusher.name', description: 'Username of the pusher' },
      { path: 'head_commit.message', description: 'Head commit message' },
      { path: 'forced', description: 'Whether this was a force push' },
    ],
  },
  {
    event: 'pull_request',
    description: 'Pull request activity',
    category: 'pull_requests',
    hasEntityBuiltIns: true,
    actions: [
      { name: 'opened', description: 'Pull request opened' },
      { name: 'closed', description: 'Pull request closed' },
    ],
    payloadPaths: [
      { path: 'pull_request.base.ref', description: 'Target branch name' },
      { path: 'pull_request.head.ref', description: 'Source branch name' },
      { path: 'pull_request.title', description: 'PR title' },
      { path: 'pull_request.draft', description: 'Whether PR is a draft' },
      { path: 'pull_request.user.login', description: 'PR author username' },
    ],
  },
  {
    event: 'issues',
    description: 'Issue activity',
    category: 'issues',
    hasEntityBuiltIns: true,
    actions: [
      { name: 'opened', description: 'Issue opened' },
      { name: 'closed', description: 'Issue closed' },
    ],
    payloadPaths: [
      { path: 'issue.title', description: 'Issue title' },
      { path: 'issue.state', description: 'Issue state' },
      { path: 'issue.user.login', description: 'Issue author username' },
    ],
  },
  {
    event: 'workflow_run',
    description: 'GitHub Actions workflow run',
    category: 'ci_cd',
    actions: [{ name: 'completed', description: 'Workflow run completed' }],
    payloadPaths: [
      { path: 'workflow_run.name', description: 'Workflow name' },
      { path: 'workflow_run.conclusion', description: 'Run conclusion' },
    ],
  },
  {
    event: 'release',
    description: 'Release activity',
    category: 'releases',
    actions: [{ name: 'published', description: 'Release published' }],
    payloadPaths: [
      { path: 'release.tag_name', description: 'Release tag name' },
      { path: 'release.name', description: 'Release title' },
    ],
  },
  {
    event: 'discussion',
    description: 'Discussion activity',
    category: 'discussions',
    actions: [{ name: 'created', description: 'Discussion created' }],
    payloadPaths: [
      { path: 'discussion.title', description: 'Discussion title' },
      { path: 'discussion.body', description: 'Discussion body text' },
    ],
  },
];

function getGroupLabels(groups: readonly VariableGroup[]): string[] {
  return groups.map((g) => g.label);
}

function getAllKeys(groups: readonly VariableGroup[]): string[] {
  return groups.flatMap((g) => g.variables.map((v) => v.key));
}

function getGroupByLabel(
  groups: readonly VariableGroup[],
  label: string,
): VariableGroup | undefined {
  return groups.find((g) => g.label === label);
}

describe('getAvailableVariables', () => {
  describe('cron trigger', () => {
    it('should return only General group', () => {
      const groups = getAvailableVariables({
        triggerType: 'cron',
        selectedEvents: [],
        allEvents: MOCK_EVENTS,
      });

      expect(getGroupLabels(groups)).toEqual(['General']);
    });

    it('should include timestamp and automation.name', () => {
      const groups = getAvailableVariables({
        triggerType: 'cron',
        selectedEvents: [],
        allEvents: MOCK_EVENTS,
      });

      const keys = getAllKeys(groups);
      expect(keys).toContain('timestamp');
      expect(keys).toContain('automation.name');
    });
  });

  describe('manual trigger', () => {
    it('should return General and Repository groups', () => {
      const groups = getAvailableVariables({
        triggerType: 'manual',
        selectedEvents: [],
        allEvents: MOCK_EVENTS,
      });

      expect(getGroupLabels(groups)).toEqual(['General', 'Repository']);
    });

    it('should include repo variables', () => {
      const groups = getAvailableVariables({
        triggerType: 'manual',
        selectedEvents: [],
        allEvents: MOCK_EVENTS,
      });

      const keys = getAllKeys(groups);
      expect(keys).toContain('repo.owner');
      expect(keys).toContain('repo.name');
      expect(keys).toContain('repo.full_name');
    });
  });

  describe('event trigger — no events selected', () => {
    it('should return General and Event Info groups', () => {
      const groups = getAvailableVariables({
        triggerType: 'event',
        selectedEvents: [],
        allEvents: MOCK_EVENTS,
      });

      expect(getGroupLabels(groups)).toEqual(['General', 'Event Info']);
    });

    it('should include event common variables', () => {
      const groups = getAvailableVariables({
        triggerType: 'event',
        selectedEvents: [],
        allEvents: MOCK_EVENTS,
      });

      const keys = getAllKeys(groups);
      expect(keys).toContain('event.type');
      expect(keys).toContain('event.action');
      expect(keys).toContain('event.repo');
    });

    it('should not include entity variables', () => {
      const groups = getAvailableVariables({
        triggerType: 'event',
        selectedEvents: [],
        allEvents: MOCK_EVENTS,
      });

      const keys = getAllKeys(groups);
      expect(keys).not.toContain('event.title');
      expect(keys).not.toContain('event.number');
    });
  });

  describe('event trigger — PR events selected', () => {
    it('should include PR / Issue group with entity variables', () => {
      const groups = getAvailableVariables({
        triggerType: 'event',
        selectedEvents: ['pull_request.opened'],
        allEvents: MOCK_EVENTS,
      });

      expect(getGroupLabels(groups)).toContain('PR / Issue');

      const entityGroup = getGroupByLabel(groups, 'PR / Issue')!;
      const keys = entityGroup.variables.map((v) => v.key);
      expect(keys).toContain('event.title');
      expect(keys).toContain('event.number');
      expect(keys).toContain('event.body');
      expect(keys).toContain('event.label');
    });

    it('should include payload paths and filter out overlapping built-ins', () => {
      const groups = getAvailableVariables({
        triggerType: 'event',
        selectedEvents: ['pull_request.opened'],
        allEvents: MOCK_EVENTS,
      });

      const payloadGroup = getGroupByLabel(groups, 'Event Payload')!;
      const keys = payloadGroup.variables.map((v) => v.key);

      // Should include non-overlapping paths
      expect(keys).toContain('pull_request.base.ref');
      expect(keys).toContain('pull_request.head.ref');
      expect(keys).toContain('pull_request.draft');
      expect(keys).toContain('pull_request.user.login');

      // Should NOT include overlapping paths (covered by event.title built-in)
      expect(keys).not.toContain('pull_request.title');
    });
  });

  describe('event trigger — issue events selected', () => {
    it('should include PR / Issue group', () => {
      const groups = getAvailableVariables({
        triggerType: 'event',
        selectedEvents: ['issues.opened'],
        allEvents: MOCK_EVENTS,
      });

      expect(getGroupLabels(groups)).toContain('PR / Issue');
    });

    it('should filter out issue.title from payload paths (covered by event.title)', () => {
      const groups = getAvailableVariables({
        triggerType: 'event',
        selectedEvents: ['issues.opened'],
        allEvents: MOCK_EVENTS,
      });

      const payloadGroup = getGroupByLabel(groups, 'Event Payload')!;
      const keys = payloadGroup.variables.map((v) => v.key);

      expect(keys).not.toContain('issue.title');
      expect(keys).toContain('issue.state');
      expect(keys).toContain('issue.user.login');
    });
  });

  describe('event trigger — push events selected', () => {
    it('should not include PR / Issue group', () => {
      const groups = getAvailableVariables({
        triggerType: 'event',
        selectedEvents: ['push'],
        allEvents: MOCK_EVENTS,
      });

      expect(getGroupLabels(groups)).not.toContain('PR / Issue');
    });

    it('should include push payload paths', () => {
      const groups = getAvailableVariables({
        triggerType: 'event',
        selectedEvents: ['push'],
        allEvents: MOCK_EVENTS,
      });

      const payloadGroup = getGroupByLabel(groups, 'Event Payload')!;
      const keys = payloadGroup.variables.map((v) => v.key);

      expect(keys).toContain('ref');
      expect(keys).toContain('pusher.name');
      expect(keys).toContain('head_commit.message');
      expect(keys).toContain('forced');
    });
  });

  describe('event trigger — mixed events selected', () => {
    it('should merge variables from multiple event types', () => {
      const groups = getAvailableVariables({
        triggerType: 'event',
        selectedEvents: ['push', 'pull_request.opened'],
        allEvents: MOCK_EVENTS,
      });

      // Should have entity variables (from PR)
      expect(getGroupLabels(groups)).toContain('PR / Issue');

      // Should have payload paths from both
      const payloadGroup = getGroupByLabel(groups, 'Event Payload')!;
      const keys = payloadGroup.variables.map((v) => v.key);

      expect(keys).toContain('ref');
      expect(keys).toContain('pusher.name');
      expect(keys).toContain('pull_request.base.ref');
      expect(keys).toContain('pull_request.user.login');
    });
  });

  describe('event trigger — non-entity events', () => {
    it('should show payload paths for workflow_run without entity group', () => {
      const groups = getAvailableVariables({
        triggerType: 'event',
        selectedEvents: ['workflow_run.completed'],
        allEvents: MOCK_EVENTS,
      });

      expect(getGroupLabels(groups)).not.toContain('PR / Issue');
      expect(getGroupLabels(groups)).toContain('Event Payload');

      const payloadGroup = getGroupByLabel(groups, 'Event Payload')!;
      const keys = payloadGroup.variables.map((v) => v.key);
      expect(keys).toContain('workflow_run.name');
      expect(keys).toContain('workflow_run.conclusion');
    });

    it('should show payload paths for release events', () => {
      const groups = getAvailableVariables({
        triggerType: 'event',
        selectedEvents: ['release.published'],
        allEvents: MOCK_EVENTS,
      });

      const payloadGroup = getGroupByLabel(groups, 'Event Payload')!;
      const keys = payloadGroup.variables.map((v) => v.key);
      expect(keys).toContain('release.tag_name');
      expect(keys).toContain('release.name');
    });

    it('should show payload paths for discussion events', () => {
      const groups = getAvailableVariables({
        triggerType: 'event',
        selectedEvents: ['discussion.created'],
        allEvents: MOCK_EVENTS,
      });

      const payloadGroup = getGroupByLabel(groups, 'Event Payload')!;
      const keys = payloadGroup.variables.map((v) => v.key);
      expect(keys).toContain('discussion.title');
      expect(keys).toContain('discussion.body');
    });
  });

  describe('shared variables', () => {
    it('should include shared variables group when provided', () => {
      const groups = getAvailableVariables({
        triggerType: 'manual',
        selectedEvents: [],
        allEvents: MOCK_EVENTS,
        sharedVariables: [
          { key: 'API_URL', description: 'API base URL' },
          { key: 'DEPLOY_ENV', description: null },
        ],
      });

      const sharedGroup = getGroupByLabel(groups, 'Shared Variables');
      expect(sharedGroup).toBeDefined();
      expect(sharedGroup!.variables).toHaveLength(2);
      expect(sharedGroup!.variables[0]).toEqual({
        key: 'API_URL',
        description: 'API base URL',
      });
      expect(sharedGroup!.variables[1]).toEqual({
        key: 'DEPLOY_ENV',
        description: 'Shared variable',
      });
    });

    it('should not include shared variables group when empty', () => {
      const groups = getAvailableVariables({
        triggerType: 'manual',
        selectedEvents: [],
        allEvents: MOCK_EVENTS,
        sharedVariables: [],
      });

      expect(getGroupByLabel(groups, 'Shared Variables')).toBeUndefined();
    });

    it('should not include shared variables group when undefined', () => {
      const groups = getAvailableVariables({
        triggerType: 'manual',
        selectedEvents: [],
        allEvents: MOCK_EVENTS,
      });

      expect(getGroupByLabel(groups, 'Shared Variables')).toBeUndefined();
    });

    it('should place shared variables after General group', () => {
      const groups = getAvailableVariables({
        triggerType: 'event',
        selectedEvents: ['pull_request.opened'],
        allEvents: MOCK_EVENTS,
        sharedVariables: [{ key: 'MY_VAR', description: 'A variable' }],
      });

      const labels = getGroupLabels(groups);
      const generalIdx = labels.indexOf('General');
      const sharedIdx = labels.indexOf('Shared Variables');
      expect(sharedIdx).toBe(generalIdx + 1);
    });

    it('should use fallback description for null descriptions', () => {
      const groups = getAvailableVariables({
        triggerType: 'manual',
        selectedEvents: [],
        allEvents: MOCK_EVENTS,
        sharedVariables: [{ key: 'SECRET', description: null }],
      });

      const sharedGroup = getGroupByLabel(groups, 'Shared Variables')!;
      expect(sharedGroup.variables[0]!.description).toBe('Shared variable');
    });

    it('should include shared variables for all trigger types', () => {
      const sharedVars = [{ key: 'TOKEN', description: 'Auth token' }];

      for (const triggerType of ['event', 'cron', 'manual'] as const) {
        const groups = getAvailableVariables({
          triggerType,
          selectedEvents: triggerType === 'event' ? ['push'] : [],
          allEvents: MOCK_EVENTS,
          sharedVariables: sharedVars,
        });

        expect(getGroupByLabel(groups, 'Shared Variables')).toBeDefined();
      }
    });
  });

  describe('variable descriptions', () => {
    it('should include descriptions for all variables', () => {
      const groups = getAvailableVariables({
        triggerType: 'event',
        selectedEvents: ['pull_request.opened'],
        allEvents: MOCK_EVENTS,
      });

      for (const group of groups) {
        for (const variable of group.variables) {
          expect(variable.description).toBeTruthy();
          expect(variable.description.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('payload path deduplication', () => {
    it('should not show duplicate paths when multiple events share the same path', () => {
      const eventsWithSharedPaths: readonly GitHubEventDefinition[] = [
        {
          event: 'pull_request',
          description: 'PR activity',
          category: 'pull_requests',
          hasEntityBuiltIns: true,
          actions: [{ name: 'opened', description: 'PR opened' }],
          payloadPaths: [{ path: 'pull_request.user.login', description: 'PR author' }],
        },
        {
          event: 'pull_request_review',
          description: 'Review activity',
          category: 'pull_requests',
          hasEntityBuiltIns: true,
          actions: [{ name: 'submitted', description: 'Review submitted' }],
          payloadPaths: [
            { path: 'pull_request.user.login', description: 'PR author' },
            { path: 'review.body', description: 'Review body' },
          ],
        },
      ];

      const groups = getAvailableVariables({
        triggerType: 'event',
        selectedEvents: ['pull_request.opened', 'pull_request_review.submitted'],
        allEvents: eventsWithSharedPaths,
      });

      const payloadGroup = getGroupByLabel(groups, 'Event Payload')!;
      const keys = payloadGroup.variables.map((v) => v.key);

      // Should appear only once
      const loginCount = keys.filter((k) => k === 'pull_request.user.login').length;
      expect(loginCount).toBe(1);

      // review.body should also be present
      expect(keys).toContain('review.body');
    });
  });
});
