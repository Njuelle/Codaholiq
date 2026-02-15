import { GitHubEventsController } from '../github-events.controller';

describe('GitHubEventsController', () => {
  let controller: GitHubEventsController;

  beforeEach(() => {
    controller = new GitHubEventsController();
  });

  describe('getGitHubEvents', () => {
    it('should return categories and events', () => {
      const result = controller.getGitHubEvents();
      expect(result).toHaveProperty('categories');
      expect(result).toHaveProperty('events');
      expect(result.categories.length).toBeGreaterThan(0);
      expect(result.events.length).toBeGreaterThan(0);
    });

    it('should include all category IDs', () => {
      const result = controller.getGitHubEvents();
      const categoryIds = result.categories.map((c) => c.id);
      expect(categoryIds).toContain('pull_requests');
      expect(categoryIds).toContain('issues');
      expect(categoryIds).toContain('ci_cd');
    });
  });
});
