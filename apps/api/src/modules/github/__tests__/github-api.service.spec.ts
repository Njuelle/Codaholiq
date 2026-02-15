import { GitHubApiService } from '../github-api.service';

const mockRedis = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
};

vi.mock('jsonwebtoken', () => ({
  sign: vi.fn().mockReturnValue('mock-app-jwt'),
}));

function createMockConfigService(): Record<string, ReturnType<typeof vi.fn>> {
  return {
    getOrThrow: vi.fn().mockImplementation((key: string) => {
      const values: Record<string, string> = {
        GITHUB_APP_ID: '12345',
        GITHUB_APP_PRIVATE_KEY: 'fake-private-key',
      };
      return values[key];
    }),
  };
}

describe('GitHubApiService', () => {
  let service: GitHubApiService;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    mockRedis.get.mockReset().mockResolvedValue(null);
    mockRedis.set.mockReset().mockResolvedValue('OK');

    const configService = createMockConfigService();
    service = new GitHubApiService(configService as never, mockRedis as never);

    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('getInstallationToken', () => {
    it('should return cached token when available', async () => {
      mockRedis.get.mockResolvedValue('cached-token-123');

      const token = await service.getInstallationToken({
        installationId: 1001,
      });

      expect(token).toBe('cached-token-123');
      expect(mockRedis.get).toHaveBeenCalledWith('gh:install-token:1001');
    });

    it('should fetch token from GitHub API on cache miss', async () => {
      const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({
            token: 'new-token-456',
            expires_at: expiresAt,
          }),
        }),
      );

      const token = await service.getInstallationToken({
        installationId: 2002,
      });

      expect(token).toBe('new-token-456');
      expect(mockRedis.set).toHaveBeenCalledWith(
        'gh:install-token:2002',
        'new-token-456',
        'EX',
        expect.any(Number),
      );

      const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
      expect(fetchCall[0]).toContain('/app/installations/2002/access_tokens');
      // Verify the JWT is used in the Authorization header
      const fetchOptions = fetchCall[1] as RequestInit;
      expect(fetchOptions.headers).toMatchObject({
        Authorization: 'Bearer mock-app-jwt',
      });
    });

    it('should throw on GitHub API error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          text: vi.fn().mockResolvedValue('Bad credentials'),
        }),
      );

      await expect(service.getInstallationToken({ installationId: 3003 })).rejects.toThrow(
        'Failed to get installation token: 401',
      );
    });
  });

  describe('getInstallationOctokit', () => {
    it('should return an Octokit instance with installation token', async () => {
      mockRedis.get.mockResolvedValue('octokit-token');

      const octokit = await service.getInstallationOctokit({
        installationId: 4004,
      });

      expect(octokit).toBeDefined();
      expect(octokit.rest).toBeDefined();
    });
  });

  describe('checkFileExists', () => {
    it('should return true when file exists', async () => {
      const mockOctokit = {
        rest: {
          repos: {
            getContent: vi.fn().mockResolvedValue({ data: {} }),
          },
        },
      };
      vi.spyOn(service, 'getInstallationOctokit').mockResolvedValue(mockOctokit as never);

      const result = await service.checkFileExists({
        installationId: 1001,
        owner: 'owner',
        repo: 'repo',
        path: '.github/workflows/codaholiq.yml',
      });

      expect(result).toBe(true);
      expect(mockOctokit.rest.repos.getContent).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        path: '.github/workflows/codaholiq.yml',
      });
    });

    it('should return false when file does not exist (404)', async () => {
      const error = new Error('Not Found') as Error & { status: number };
      error.status = 404;
      const mockOctokit = {
        rest: {
          repos: {
            getContent: vi.fn().mockRejectedValue(error),
          },
        },
      };
      vi.spyOn(service, 'getInstallationOctokit').mockResolvedValue(mockOctokit as never);

      const result = await service.checkFileExists({
        installationId: 1001,
        owner: 'owner',
        repo: 'repo',
        path: '.github/workflows/codaholiq.yml',
      });

      expect(result).toBe(false);
    });

    it('should rethrow non-404 errors', async () => {
      const error = new Error('Server Error') as Error & { status: number };
      error.status = 500;
      const mockOctokit = {
        rest: {
          repos: {
            getContent: vi.fn().mockRejectedValue(error),
          },
        },
      };
      vi.spyOn(service, 'getInstallationOctokit').mockResolvedValue(mockOctokit as never);

      await expect(
        service.checkFileExists({
          installationId: 1001,
          owner: 'owner',
          repo: 'repo',
          path: '.github/workflows/codaholiq.yml',
        }),
      ).rejects.toThrow('Server Error');
    });
  });

  describe('listWorkflowRuns', () => {
    it('should return workflow runs filtered by workflow file and date', async () => {
      const mockOctokit = {
        rest: {
          actions: {
            listWorkflowRuns: vi.fn().mockResolvedValue({
              data: {
                workflow_runs: [
                  {
                    id: 100,
                    status: 'completed',
                    conclusion: 'success',
                    html_url: 'https://github.com/owner/repo/actions/runs/100',
                  },
                ],
              },
            }),
          },
        },
      };
      mockRedis.get.mockResolvedValue('cached-token');
      vi.spyOn(service, 'getInstallationOctokit').mockResolvedValue(mockOctokit as never);

      const runs = await service.listWorkflowRuns({
        installationId: 1001,
        owner: 'owner',
        repo: 'repo',
        workflowFile: 'ci.yml',
        createdAfter: '2025-01-01T00:00:00Z',
      });

      expect(runs).toEqual([
        {
          id: 100,
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://github.com/owner/repo/actions/runs/100',
        },
      ]);
      expect(mockOctokit.rest.actions.listWorkflowRuns).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        workflow_id: 'ci.yml',
        created: '>=2025-01-01T00:00:00Z',
        per_page: 10,
      });
    });
  });

  describe('cancelWorkflowRun', () => {
    it('should cancel a workflow run', async () => {
      const mockOctokit = {
        rest: {
          actions: {
            cancelWorkflowRun: vi.fn().mockResolvedValue({}),
          },
        },
      };
      mockRedis.get.mockResolvedValue('cached-token');
      vi.spyOn(service, 'getInstallationOctokit').mockResolvedValue(mockOctokit as never);

      await service.cancelWorkflowRun({
        installationId: 1001,
        owner: 'owner',
        repo: 'repo',
        runId: 200,
      });

      expect(mockOctokit.rest.actions.cancelWorkflowRun).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        run_id: 200,
      });
    });
  });

  describe('listIssueComments', () => {
    it('should return formatted comments', async () => {
      const mockOctokit = {
        rest: {
          issues: {
            listComments: vi.fn().mockResolvedValue({
              data: [
                {
                  user: { login: 'alice' },
                  body: 'First comment',
                  created_at: '2025-06-01T10:00:00Z',
                },
                {
                  user: { login: 'bob' },
                  body: 'Second comment',
                  created_at: '2025-06-02T12:00:00Z',
                },
              ],
            }),
          },
        },
      };
      vi.spyOn(service, 'getInstallationOctokit').mockResolvedValue(mockOctokit as never);

      const comments = await service.listIssueComments({
        installationId: 1001,
        owner: 'owner',
        repo: 'repo',
        issueNumber: 42,
      });

      expect(comments).toEqual([
        { login: 'alice', body: 'First comment', createdAt: '2025-06-01T10:00:00Z' },
        { login: 'bob', body: 'Second comment', createdAt: '2025-06-02T12:00:00Z' },
      ]);
      expect(mockOctokit.rest.issues.listComments).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 42,
        per_page: 30,
        direction: 'asc',
      });
    });

    it('should truncate long comment bodies to 2000 chars', async () => {
      const longBody = 'x'.repeat(3000);
      const mockOctokit = {
        rest: {
          issues: {
            listComments: vi.fn().mockResolvedValue({
              data: [
                { user: { login: 'alice' }, body: longBody, created_at: '2025-06-01T10:00:00Z' },
              ],
            }),
          },
        },
      };
      vi.spyOn(service, 'getInstallationOctokit').mockResolvedValue(mockOctokit as never);

      const comments = await service.listIssueComments({
        installationId: 1001,
        owner: 'owner',
        repo: 'repo',
        issueNumber: 1,
      });

      expect(comments[0].body).toHaveLength(2000);
    });

    it('should handle missing user login gracefully', async () => {
      const mockOctokit = {
        rest: {
          issues: {
            listComments: vi.fn().mockResolvedValue({
              data: [{ user: null, body: 'ghost comment', created_at: '2025-06-01T10:00:00Z' }],
            }),
          },
        },
      };
      vi.spyOn(service, 'getInstallationOctokit').mockResolvedValue(mockOctokit as never);

      const comments = await service.listIssueComments({
        installationId: 1001,
        owner: 'owner',
        repo: 'repo',
        issueNumber: 1,
      });

      expect(comments[0].login).toBe('unknown');
    });
  });

  describe('listPullRequestReviews', () => {
    it('should return formatted reviews', async () => {
      const mockOctokit = {
        rest: {
          pulls: {
            listReviews: vi.fn().mockResolvedValue({
              data: [
                {
                  user: { login: 'reviewer1' },
                  body: 'Looks good',
                  state: 'APPROVED',
                  submitted_at: '2025-06-01T10:00:00Z',
                  commit_id: 'abc123',
                },
                {
                  user: { login: 'reviewer2' },
                  body: 'Please fix line 42',
                  state: 'CHANGES_REQUESTED',
                  submitted_at: '2025-06-02T12:00:00Z',
                  commit_id: 'def456',
                },
              ],
            }),
          },
        },
      };
      vi.spyOn(service, 'getInstallationOctokit').mockResolvedValue(mockOctokit as never);

      const reviews = await service.listPullRequestReviews({
        installationId: 1001,
        owner: 'owner',
        repo: 'repo',
        pullNumber: 10,
      });

      expect(reviews).toEqual([
        {
          login: 'reviewer1',
          body: 'Looks good',
          state: 'APPROVED',
          createdAt: '2025-06-01T10:00:00Z',
        },
        {
          login: 'reviewer2',
          body: 'Please fix line 42',
          state: 'CHANGES_REQUESTED',
          createdAt: '2025-06-02T12:00:00Z',
        },
      ]);
      expect(mockOctokit.rest.pulls.listReviews).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 10,
        per_page: 30,
      });
    });

    it('should fall back to "pending" when submitted_at is null', async () => {
      const mockOctokit = {
        rest: {
          pulls: {
            listReviews: vi.fn().mockResolvedValue({
              data: [
                {
                  user: { login: 'reviewer' },
                  body: 'pending review',
                  state: 'PENDING',
                  submitted_at: null,
                  commit_id: 'sha123',
                },
              ],
            }),
          },
        },
      };
      vi.spyOn(service, 'getInstallationOctokit').mockResolvedValue(mockOctokit as never);

      const reviews = await service.listPullRequestReviews({
        installationId: 1001,
        owner: 'owner',
        repo: 'repo',
        pullNumber: 5,
      });

      expect(reviews[0].createdAt).toBe('pending');
    });
  });
});
