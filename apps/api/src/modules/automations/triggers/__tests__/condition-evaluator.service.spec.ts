import {
  ConditionEvaluatorService,
  type ConditionGroup,
  type TriggerCondition,
} from '../condition-evaluator.service';

describe('ConditionEvaluatorService', () => {
  let service: ConditionEvaluatorService;

  beforeEach(() => {
    service = new ConditionEvaluatorService();
  });

  // ── evaluateGroups ──────────────────────────────────────────────

  describe('evaluateGroups', () => {
    it('should return true when conditionGroups is undefined', () => {
      expect(service.evaluateGroups({ conditionGroups: undefined, payload: {} })).toBe(true);
    });

    it('should return true when conditionGroups is empty', () => {
      expect(service.evaluateGroups({ conditionGroups: [], payload: {} })).toBe(true);
    });

    it('should return true when a group has no conditions', () => {
      const groups: ConditionGroup[] = [{ conditions: [] }];
      expect(service.evaluateGroups({ conditionGroups: groups, payload: {} })).toBe(true);
    });

    it('should return true when all conditions in a single group pass (AND)', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [
            { path: 'ref', operator: 'equals', value: 'refs/heads/main' },
            { path: 'pusher.name', operator: 'equals', value: 'alice' },
          ],
        },
      ];
      const payload = { ref: 'refs/heads/main', pusher: { name: 'alice' } };
      expect(service.evaluateGroups({ conditionGroups: groups, payload })).toBe(true);
    });

    it('should return false when any condition in a group fails (AND)', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [
            { path: 'ref', operator: 'equals', value: 'refs/heads/main' },
            { path: 'pusher.name', operator: 'equals', value: 'bob' },
          ],
        },
      ];
      const payload = { ref: 'refs/heads/main', pusher: { name: 'alice' } };
      expect(service.evaluateGroups({ conditionGroups: groups, payload })).toBe(false);
    });

    it('should return true when any group matches (OR)', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [{ path: 'ref', operator: 'equals', value: 'refs/heads/main' }],
        },
        {
          conditions: [
            {
              path: 'ref',
              operator: 'starts_with',
              value: 'refs/heads/release/',
            },
          ],
        },
      ];
      const payload = { ref: 'refs/heads/release/1.0' };
      expect(service.evaluateGroups({ conditionGroups: groups, payload })).toBe(true);
    });

    it('should return false when no group matches (OR)', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [{ path: 'ref', operator: 'equals', value: 'refs/heads/main' }],
        },
        {
          conditions: [
            {
              path: 'ref',
              operator: 'starts_with',
              value: 'refs/heads/release/',
            },
          ],
        },
      ];
      const payload = { ref: 'refs/heads/feature/123' };
      expect(service.evaluateGroups({ conditionGroups: groups, payload })).toBe(false);
    });
  });

  // ── Operators ───────────────────────────────────────────────────

  describe('equals', () => {
    const condition = (value: string): TriggerCondition => ({
      path: 'ref',
      operator: 'equals',
      value,
    });

    it('should match equal strings', () => {
      const groups: ConditionGroup[] = [{ conditions: [condition('main')] }];
      expect(
        service.evaluateGroups({
          conditionGroups: groups,
          payload: { ref: 'main' },
        }),
      ).toBe(true);
    });

    it('should not match different strings', () => {
      const groups: ConditionGroup[] = [{ conditions: [condition('main')] }];
      expect(
        service.evaluateGroups({
          conditionGroups: groups,
          payload: { ref: 'develop' },
        }),
      ).toBe(false);
    });

    it('should coerce booleans to string', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [{ path: 'pull_request.draft', operator: 'equals', value: 'false' }],
        },
      ];
      expect(
        service.evaluateGroups({
          conditionGroups: groups,
          payload: { pull_request: { draft: false } },
        }),
      ).toBe(true);
    });

    it('should coerce numbers to string', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [{ path: 'pull_request.number', operator: 'equals', value: '42' }],
        },
      ];
      expect(
        service.evaluateGroups({
          conditionGroups: groups,
          payload: { pull_request: { number: 42 } },
        }),
      ).toBe(true);
    });

    it('should return false when path is missing', () => {
      const groups: ConditionGroup[] = [{ conditions: [condition('main')] }];
      expect(service.evaluateGroups({ conditionGroups: groups, payload: {} })).toBe(false);
    });
  });

  describe('not_equals', () => {
    it('should return true when values differ', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [{ path: 'ref', operator: 'not_equals', value: 'main' }],
        },
      ];
      expect(
        service.evaluateGroups({
          conditionGroups: groups,
          payload: { ref: 'develop' },
        }),
      ).toBe(true);
    });

    it('should return false when values match', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [{ path: 'ref', operator: 'not_equals', value: 'main' }],
        },
      ];
      expect(
        service.evaluateGroups({
          conditionGroups: groups,
          payload: { ref: 'main' },
        }),
      ).toBe(false);
    });
  });

  describe('contains', () => {
    it('should match substring in strings', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [{ path: 'head_commit.message', operator: 'contains', value: 'fix' }],
        },
      ];
      expect(
        service.evaluateGroups({
          conditionGroups: groups,
          payload: { head_commit: { message: 'fix: resolve null pointer' } },
        }),
      ).toBe(true);
    });

    it('should not match missing substring', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [{ path: 'head_commit.message', operator: 'contains', value: 'feat' }],
        },
      ];
      expect(
        service.evaluateGroups({
          conditionGroups: groups,
          payload: { head_commit: { message: 'fix: resolve null pointer' } },
        }),
      ).toBe(false);
    });

    it('should match .name property in array of objects (labels)', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [{ path: 'pull_request.labels', operator: 'contains', value: 'bug' }],
        },
      ];
      const payload = {
        pull_request: {
          labels: [
            { id: 1, name: 'bug', color: 'red' },
            { id: 2, name: 'priority', color: 'orange' },
          ],
        },
      };
      expect(service.evaluateGroups({ conditionGroups: groups, payload })).toBe(true);
    });

    it('should not match when label name is absent in array', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [{ path: 'pull_request.labels', operator: 'contains', value: 'critical' }],
        },
      ];
      const payload = {
        pull_request: {
          labels: [
            { id: 1, name: 'bug' },
            { id: 2, name: 'priority' },
          ],
        },
      };
      expect(service.evaluateGroups({ conditionGroups: groups, payload })).toBe(false);
    });

    it('should match primitive values in arrays', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [{ path: 'tags', operator: 'contains', value: 'v1.0' }],
        },
      ];
      expect(
        service.evaluateGroups({
          conditionGroups: groups,
          payload: { tags: ['v1.0', 'v2.0'] },
        }),
      ).toBe(true);
    });
  });

  describe('not_contains', () => {
    it('should return true when substring is absent', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [{ path: 'ref', operator: 'not_contains', value: 'release' }],
        },
      ];
      expect(
        service.evaluateGroups({
          conditionGroups: groups,
          payload: { ref: 'refs/heads/main' },
        }),
      ).toBe(true);
    });

    it('should return true when label name is absent in array', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [
            {
              path: 'pull_request.labels',
              operator: 'not_contains',
              value: 'wip',
            },
          ],
        },
      ];
      const payload = {
        pull_request: { labels: [{ name: 'bug' }] },
      };
      expect(service.evaluateGroups({ conditionGroups: groups, payload })).toBe(true);
    });
  });

  describe('starts_with', () => {
    it('should match prefix', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [
            {
              path: 'ref',
              operator: 'starts_with',
              value: 'refs/heads/release/',
            },
          ],
        },
      ];
      expect(
        service.evaluateGroups({
          conditionGroups: groups,
          payload: { ref: 'refs/heads/release/1.0' },
        }),
      ).toBe(true);
    });

    it('should not match non-prefix', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [
            {
              path: 'ref',
              operator: 'starts_with',
              value: 'refs/heads/release/',
            },
          ],
        },
      ];
      expect(
        service.evaluateGroups({
          conditionGroups: groups,
          payload: { ref: 'refs/heads/main' },
        }),
      ).toBe(false);
    });
  });

  describe('ends_with', () => {
    it('should match suffix', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [{ path: 'release.tag_name', operator: 'ends_with', value: '-rc' }],
        },
      ];
      expect(
        service.evaluateGroups({
          conditionGroups: groups,
          payload: { release: { tag_name: 'v1.0.0-rc' } },
        }),
      ).toBe(true);
    });
  });

  describe('matches', () => {
    it('should match valid regex', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [
            {
              path: 'ref',
              operator: 'matches',
              value: '^refs/heads/(main|develop)$',
            },
          ],
        },
      ];
      expect(
        service.evaluateGroups({
          conditionGroups: groups,
          payload: { ref: 'refs/heads/main' },
        }),
      ).toBe(true);
    });

    it('should not match when regex does not match', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [
            {
              path: 'ref',
              operator: 'matches',
              value: '^refs/heads/(main|develop)$',
            },
          ],
        },
      ];
      expect(
        service.evaluateGroups({
          conditionGroups: groups,
          payload: { ref: 'refs/heads/feature/123' },
        }),
      ).toBe(false);
    });

    it('should return false for invalid regex (no throw)', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [{ path: 'ref', operator: 'matches', value: '[invalid(' }],
        },
      ];
      expect(
        service.evaluateGroups({
          conditionGroups: groups,
          payload: { ref: 'anything' },
        }),
      ).toBe(false);
    });

    it('should return false for regex exceeding max length', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [{ path: 'ref', operator: 'matches', value: 'a'.repeat(201) }],
        },
      ];
      expect(
        service.evaluateGroups({
          conditionGroups: groups,
          payload: { ref: 'a'.repeat(201) },
        }),
      ).toBe(false);
    });

    it('should return false for ReDoS pattern with nested quantifiers', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [{ path: 'ref', operator: 'matches', value: '(a+)+b' }],
        },
      ];
      expect(
        service.evaluateGroups({
          conditionGroups: groups,
          payload: { ref: 'aaaaaaaaa' },
        }),
      ).toBe(false);
    });

    it('should return false for ReDoS pattern (a*)*', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [{ path: 'ref', operator: 'matches', value: '(a*)*' }],
        },
      ];
      expect(
        service.evaluateGroups({
          conditionGroups: groups,
          payload: { ref: 'test' },
        }),
      ).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true when path resolves to a value', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [{ path: 'issue.pull_request', operator: 'exists' }],
        },
      ];
      expect(
        service.evaluateGroups({
          conditionGroups: groups,
          payload: { issue: { pull_request: { url: 'https://...' } } },
        }),
      ).toBe(true);
    });

    it('should return true when path resolves to false (value exists)', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [{ path: 'pull_request.draft', operator: 'exists' }],
        },
      ];
      expect(
        service.evaluateGroups({
          conditionGroups: groups,
          payload: { pull_request: { draft: false } },
        }),
      ).toBe(true);
    });

    it('should return true when path resolves to empty string', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [{ path: 'description', operator: 'exists' }],
        },
      ];
      expect(
        service.evaluateGroups({
          conditionGroups: groups,
          payload: { description: '' },
        }),
      ).toBe(true);
    });

    it('should return false when path does not exist', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [{ path: 'issue.pull_request', operator: 'exists' }],
        },
      ];
      expect(
        service.evaluateGroups({
          conditionGroups: groups,
          payload: { issue: { title: 'Bug report' } },
        }),
      ).toBe(false);
    });
  });

  describe('not_exists', () => {
    it('should return true when path does not exist', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [{ path: 'issue.pull_request', operator: 'not_exists' }],
        },
      ];
      expect(
        service.evaluateGroups({
          conditionGroups: groups,
          payload: { issue: { title: 'Bug report' } },
        }),
      ).toBe(true);
    });

    it('should return false when path exists', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [{ path: 'issue.pull_request', operator: 'not_exists' }],
        },
      ];
      expect(
        service.evaluateGroups({
          conditionGroups: groups,
          payload: { issue: { pull_request: { url: 'https://...' } } },
        }),
      ).toBe(false);
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle deeply nested paths', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [
            {
              path: 'pull_request.head.repo.owner.login',
              operator: 'equals',
              value: 'octocat',
            },
          ],
        },
      ];
      const payload = {
        pull_request: {
          head: { repo: { owner: { login: 'octocat' } } },
        },
      };
      expect(service.evaluateGroups({ conditionGroups: groups, payload })).toBe(true);
    });

    it('should return false for value operators when path resolves to null', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [{ path: 'value', operator: 'equals', value: 'something' }],
        },
      ];
      expect(
        service.evaluateGroups({
          conditionGroups: groups,
          payload: { value: null },
        }),
      ).toBe(false);
    });

    it('should handle complex OR + AND combination', () => {
      const groups: ConditionGroup[] = [
        {
          // Group 1: push to main AND by specific user
          conditions: [
            { path: 'ref', operator: 'equals', value: 'refs/heads/main' },
            { path: 'pusher.name', operator: 'equals', value: 'deploy-bot' },
          ],
        },
        {
          // Group 2: push to any release branch
          conditions: [
            {
              path: 'ref',
              operator: 'starts_with',
              value: 'refs/heads/release/',
            },
          ],
        },
      ];

      // Matches group 2 only
      expect(
        service.evaluateGroups({
          conditionGroups: groups,
          payload: { ref: 'refs/heads/release/1.0', pusher: { name: 'alice' } },
        }),
      ).toBe(true);

      // Matches group 1 only
      expect(
        service.evaluateGroups({
          conditionGroups: groups,
          payload: {
            ref: 'refs/heads/main',
            pusher: { name: 'deploy-bot' },
          },
        }),
      ).toBe(true);

      // Matches neither
      expect(
        service.evaluateGroups({
          conditionGroups: groups,
          payload: {
            ref: 'refs/heads/main',
            pusher: { name: 'alice' },
          },
        }),
      ).toBe(false);
    });
  });
});
