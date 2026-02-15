import { queryKeys } from '../query-keys';

describe('queryKeys', () => {
  it('should return unique keys for different org ids', () => {
    const key1 = queryKeys.orgs.detail(1);
    const key2 = queryKeys.orgs.detail(2);
    expect(key1).not.toEqual(key2);
  });

  it('should return correct structure for nested keys', () => {
    expect(queryKeys.repos.all(1)).toEqual(['orgs', 1, 'repos']);
    expect(queryKeys.repos.detail({ orgId: 1, repoId: 5 })).toEqual(['orgs', 1, 'repos', 5]);
  });

  it('should return correct keys for automations', () => {
    expect(queryKeys.automations.all(1)).toEqual(['orgs', 1, 'automations']);
    expect(queryKeys.automations.detail({ orgId: 1, automationId: 3 })).toEqual([
      'orgs',
      1,
      'automations',
      3,
    ]);
  });

  it('should return correct keys for executions', () => {
    expect(queryKeys.executions.all(1)).toEqual(['orgs', 1, 'executions']);
    expect(queryKeys.executions.detail({ orgId: 1, executionId: 7 })).toEqual([
      'orgs',
      1,
      'executions',
      7,
    ]);
    expect(queryKeys.executions.logs({ orgId: 1, executionId: 7 })).toEqual([
      'orgs',
      1,
      'executions',
      7,
      'logs',
    ]);
  });

  it('should return correct keys for dashboard', () => {
    expect(queryKeys.dashboard.stats(1)).toEqual(['orgs', 1, 'dashboard']);
  });

  it('should scope all org-specific keys under orgs prefix', () => {
    const keys = [
      queryKeys.repos.all(1),
      queryKeys.automations.all(1),
      queryKeys.executions.all(1),
      queryKeys.dashboard.stats(1),
    ];
    for (const key of keys) {
      expect(key[0]).toBe('orgs');
      expect(key[1]).toBe(1);
    }
  });
});
