import {
  GITHUB_EVENTS_CATALOG,
  GITHUB_EVENT_CATEGORIES,
  buildValidEventStrings,
} from '../github-events';

describe('GitHub Events Catalog', () => {
  describe('GITHUB_EVENTS_CATALOG', () => {
    it('should not be empty', () => {
      expect(GITHUB_EVENTS_CATALOG.length).toBeGreaterThan(0);
    });

    it('should have event, description, category, and actions on every entry', () => {
      for (const entry of GITHUB_EVENTS_CATALOG) {
        expect(entry.event).toBeDefined();
        expect(typeof entry.event).toBe('string');
        expect(entry.event.length).toBeGreaterThan(0);

        expect(entry.description).toBeDefined();
        expect(typeof entry.description).toBe('string');
        expect(entry.description.length).toBeGreaterThan(0);

        expect(entry.category).toBeDefined();
        expect(typeof entry.category).toBe('string');
        expect(entry.category.length).toBeGreaterThan(0);

        expect(entry.actions).toBeDefined();
        expect(Array.isArray(entry.actions)).toBe(true);
      }
    });

    it('should have valid name and description on every action', () => {
      for (const entry of GITHUB_EVENTS_CATALOG) {
        for (const action of entry.actions) {
          expect(typeof action.name).toBe('string');
          expect(action.name.length).toBeGreaterThan(0);
          expect(typeof action.description).toBe('string');
          expect(action.description.length).toBeGreaterThan(0);
        }
      }
    });

    it('should have unique event names', () => {
      const eventNames = GITHUB_EVENTS_CATALOG.map((e) => e.event);
      const uniqueNames = new Set(eventNames);
      expect(uniqueNames.size).toBe(eventNames.length);
    });

    it('should contain well-known events', () => {
      const eventNames = new Set(GITHUB_EVENTS_CATALOG.map((e) => e.event));

      expect(eventNames.has('push')).toBe(true);
      expect(eventNames.has('pull_request')).toBe(true);
      expect(eventNames.has('issues')).toBe(true);
      expect(eventNames.has('workflow_run')).toBe(true);
      expect(eventNames.has('issue_comment')).toBe(true);
      expect(eventNames.has('release')).toBe(true);
      expect(eventNames.has('create')).toBe(true);
      expect(eventNames.has('delete')).toBe(true);
      expect(eventNames.has('fork')).toBe(true);
      expect(eventNames.has('repository')).toBe(true);
      expect(eventNames.has('discussion')).toBe(true);
      expect(eventNames.has('check_run')).toBe(true);
      expect(eventNames.has('deployment')).toBe(true);
    });

    it('should reference only valid categories from GITHUB_EVENT_CATEGORIES', () => {
      const validCategoryIds = new Set(GITHUB_EVENT_CATEGORIES.map((c) => c.id));

      for (const entry of GITHUB_EVENTS_CATALOG) {
        expect(validCategoryIds.has(entry.category)).toBe(true);
      }
    });

    it('should have conclusions only as non-empty string arrays when present', () => {
      const entriesWithConclusions = GITHUB_EVENTS_CATALOG.filter((e) => e.conclusions);

      expect(entriesWithConclusions.length).toBeGreaterThan(0);

      for (const entry of entriesWithConclusions) {
        expect(Array.isArray(entry.conclusions)).toBe(true);
        expect(entry.conclusions!.length).toBeGreaterThan(0);
        for (const conclusion of entry.conclusions!) {
          expect(typeof conclusion).toBe('string');
          expect(conclusion.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('GITHUB_EVENT_CATEGORIES', () => {
    it('should not be empty', () => {
      expect(GITHUB_EVENT_CATEGORIES.length).toBeGreaterThan(0);
    });

    it('should have id and label on every entry', () => {
      for (const category of GITHUB_EVENT_CATEGORIES) {
        expect(category.id).toBeDefined();
        expect(typeof category.id).toBe('string');
        expect(category.id.length).toBeGreaterThan(0);

        expect(category.label).toBeDefined();
        expect(typeof category.label).toBe('string');
        expect(category.label.length).toBeGreaterThan(0);
      }
    });

    it('should have unique category ids', () => {
      const ids = GITHUB_EVENT_CATEGORIES.map((c) => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should include expected categories', () => {
      const categoryIds = new Set(GITHUB_EVENT_CATEGORIES.map((c) => c.id));

      expect(categoryIds.has('code_and_commits')).toBe(true);
      expect(categoryIds.has('pull_requests')).toBe(true);
      expect(categoryIds.has('issues')).toBe(true);
      expect(categoryIds.has('ci_cd')).toBe(true);
      expect(categoryIds.has('releases')).toBe(true);
      expect(categoryIds.has('security')).toBe(true);
      expect(categoryIds.has('repositories')).toBe(true);
      expect(categoryIds.has('discussions')).toBe(true);
      expect(categoryIds.has('projects')).toBe(true);
    });
  });

  describe('buildValidEventStrings', () => {
    const validEvents = buildValidEventStrings(GITHUB_EVENTS_CATALOG);

    it('should return a Set', () => {
      expect(validEvents).toBeInstanceOf(Set);
    });

    it('should not be empty', () => {
      expect(validEvents.size).toBeGreaterThan(0);
    });

    it('should include bare events for entries with no actions', () => {
      // push, create, delete, fork, etc. have no actions
      expect(validEvents.has('push')).toBe(true);
      expect(validEvents.has('create')).toBe(true);
      expect(validEvents.has('delete')).toBe(true);
      expect(validEvents.has('fork')).toBe(true);
      expect(validEvents.has('gollum')).toBe(true);
      expect(validEvents.has('public')).toBe(true);
      expect(validEvents.has('ping')).toBe(true);
      expect(validEvents.has('status')).toBe(true);
      expect(validEvents.has('page_build')).toBe(true);
    });

    it('should not include bare event name for entries that have actions', () => {
      // pull_request has actions, so the bare name should not be in the set
      expect(validEvents.has('pull_request')).toBe(false);
      expect(validEvents.has('issues')).toBe(false);
      expect(validEvents.has('release')).toBe(false);
      expect(validEvents.has('workflow_run')).toBe(false);
    });

    it('should include compound events (event.action)', () => {
      expect(validEvents.has('pull_request.opened')).toBe(true);
      expect(validEvents.has('pull_request.closed')).toBe(true);
      expect(validEvents.has('pull_request.merged')).toBe(true);
      expect(validEvents.has('pull_request.synchronize')).toBe(true);
      expect(validEvents.has('issues.opened')).toBe(true);
      expect(validEvents.has('issues.closed')).toBe(true);
      expect(validEvents.has('issue_comment.created')).toBe(true);
      expect(validEvents.has('release.published')).toBe(true);
      expect(validEvents.has('workflow_run.completed')).toBe(true);
      expect(validEvents.has('workflow_run.requested')).toBe(true);
      expect(validEvents.has('discussion.created')).toBe(true);
      expect(validEvents.has('projects_v2_item.created')).toBe(true);
    });

    it('should include conclusion-based events (event.action.conclusion)', () => {
      expect(validEvents.has('workflow_run.completed.failure')).toBe(true);
      expect(validEvents.has('workflow_run.completed.success')).toBe(true);
      expect(validEvents.has('workflow_run.completed.cancelled')).toBe(true);
      expect(validEvents.has('workflow_run.completed.timed_out')).toBe(true);
      expect(validEvents.has('workflow_run.completed.skipped')).toBe(true);
      expect(validEvents.has('workflow_run.requested.failure')).toBe(true);
      expect(validEvents.has('workflow_run.in_progress.success')).toBe(true);
    });

    it('should include conclusion-based events for other CI/CD events', () => {
      expect(validEvents.has('workflow_job.completed.failure')).toBe(true);
      expect(validEvents.has('workflow_job.queued.success')).toBe(true);
      expect(validEvents.has('check_run.completed.success')).toBe(true);
      expect(validEvents.has('check_run.completed.action_required')).toBe(true);
      expect(validEvents.has('check_suite.completed.stale')).toBe(true);
    });

    it('should not include invalid event strings', () => {
      expect(validEvents.has('')).toBe(false);
      expect(validEvents.has('nonexistent_event')).toBe(false);
      expect(validEvents.has('push.opened')).toBe(false); // push has no actions
      expect(validEvents.has('pull_request.nonexistent')).toBe(false);
      expect(validEvents.has('workflow_run.completed.nonexistent')).toBe(false);
    });

    it('should work with an empty catalog', () => {
      const emptyResult = buildValidEventStrings([]);
      expect(emptyResult).toBeInstanceOf(Set);
      expect(emptyResult.size).toBe(0);
    });

    it('should work with a minimal catalog entry (no actions, no conclusions)', () => {
      const result = buildValidEventStrings([
        {
          event: 'test_event',
          description: 'A test event',
          category: 'code_and_commits',
          actions: [],
        },
      ]);

      expect(result.size).toBe(1);
      expect(result.has('test_event')).toBe(true);
    });

    it('should work with a catalog entry that has actions but no conclusions', () => {
      const result = buildValidEventStrings([
        {
          event: 'test_event',
          description: 'A test event',
          category: 'code_and_commits',
          actions: [
            { name: 'action_a', description: 'Action A' },
            { name: 'action_b', description: 'Action B' },
          ],
        },
      ]);

      expect(result.size).toBe(2);
      expect(result.has('test_event.action_a')).toBe(true);
      expect(result.has('test_event.action_b')).toBe(true);
      expect(result.has('test_event')).toBe(false);
    });

    it('should work with a catalog entry that has actions and conclusions', () => {
      const result = buildValidEventStrings([
        {
          event: 'test_event',
          description: 'A test event',
          category: 'ci_cd',
          actions: [
            { name: 'completed', description: 'Completed' },
            { name: 'started', description: 'Started' },
          ],
          conclusions: ['success', 'failure'],
        },
      ]);

      // 2 compound (event.action) + 4 conclusion-based (event.action.conclusion)
      expect(result.size).toBe(6);
      expect(result.has('test_event.completed')).toBe(true);
      expect(result.has('test_event.started')).toBe(true);
      expect(result.has('test_event.completed.success')).toBe(true);
      expect(result.has('test_event.completed.failure')).toBe(true);
      expect(result.has('test_event.started.success')).toBe(true);
      expect(result.has('test_event.started.failure')).toBe(true);
    });
  });
});
