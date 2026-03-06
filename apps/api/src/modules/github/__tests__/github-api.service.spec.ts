import { GitHubApiService } from '../github-api.service';

const mockRedis = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
};

const mockEncryption = {
  encrypt: vi.fn().mockImplementation(({ plaintext }: { plaintext: string }) => `enc:${plaintext}`),
  decrypt: vi
    .fn()
    .mockImplementation(({ encrypted }: { encrypted: string }) => encrypted.replace('enc:', '')),
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
    mockEncryption.encrypt.mockClear();
    mockEncryption.decrypt.mockClear();
    mockEncryption.encrypt.mockImplementation(
      ({ plaintext }: { plaintext: string }) => `enc:${plaintext}`,
    );
    mockEncryption.decrypt.mockImplementation(({ encrypted }: { encrypted: string }) =>
      encrypted.replace('enc:', ''),
    );

    const configService = createMockConfigService();
    service = new GitHubApiService(
      configService as never,
      mockRedis as never,
      mockEncryption as never,
    );

    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('getInstallationToken', () => {
    it('should return cached token when available', async () => {
      mockRedis.get.mockResolvedValue('enc:cached-token-123');

      const token = await service.getInstallationToken({
        installationId: 1001,
      });

      expect(token).toBe('cached-token-123');
      expect(mockRedis.get).toHaveBeenCalledWith('gh:install-token:1001');
      expect(mockEncryption.decrypt).toHaveBeenCalledWith({ encrypted: 'enc:cached-token-123' });
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
      expect(mockEncryption.encrypt).toHaveBeenCalledWith({ plaintext: 'new-token-456' });
      expect(mockRedis.set).toHaveBeenCalledWith(
        'gh:install-token:2002',
        'enc:new-token-456',
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
        'Failed to get installation token: HTTP 401',
      );
    });
  });

  describe('getInstallationOctokit', () => {
    it('should return an Octokit instance with installation token', async () => {
      mockRedis.get.mockResolvedValue('enc:octokit-token');

      const octokit = await service.getInstallationOctokit({
        installationId: 4004,
      });

      expect(octokit).toBeDefined();
      expect(octokit.rest).toBeDefined();
    });
  });

  describe('listRepositories', () => {
    it('should return mapped repositories from paginated GitHub API', async () => {
      const mockOctokit = {
        paginate: vi.fn().mockResolvedValue([
          {
            id: 1,
            name: 'my-repo',
            full_name: 'owner/my-repo',
            owner: { login: 'owner' },
            default_branch: 'main',
            private: false,
            language: 'TypeScript',
            archived: false,
          },
        ]),
        rest: { apps: { listReposAccessibleToInstallation: vi.fn() } },
      };
      vi.spyOn(service, 'getInstallationOctokit').mockResolvedValue(mockOctokit as never);

      const repos = await service.listRepositories({ installationId: 1001 });

      expect(repos).toEqual([
        {
          id: 1,
          name: 'my-repo',
          full_name: 'owner/my-repo',
          owner: { login: 'owner' },
          default_branch: 'main',
          private: false,
          language: 'TypeScript',
          archived: false,
        },
      ]);
    });
  });

  describe('getRepository', () => {
    it('should return a single mapped repository', async () => {
      const mockOctokit = {
        rest: {
          repos: {
            get: vi.fn().mockResolvedValue({
              data: {
                id: 2,
                name: 'other-repo',
                full_name: 'owner/other-repo',
                owner: { login: 'owner' },
                default_branch: 'develop',
                private: true,
                language: null,
                archived: false,
              },
            }),
          },
        },
      };
      vi.spyOn(service, 'getInstallationOctokit').mockResolvedValue(mockOctokit as never);

      const repo = await service.getRepository({
        installationId: 1001,
        owner: 'owner',
        repo: 'other-repo',
      });

      expect(repo).toEqual({
        id: 2,
        name: 'other-repo',
        full_name: 'owner/other-repo',
        owner: { login: 'owner' },
        default_branch: 'develop',
        private: true,
        language: null,
        archived: false,
      });
    });
  });

  describe('dispatchWorkflow', () => {
    it('should dispatch a workflow with correct params', async () => {
      const mockOctokit = {
        rest: {
          actions: {
            createWorkflowDispatch: vi.fn().mockResolvedValue({}),
          },
        },
      };
      vi.spyOn(service, 'getInstallationOctokit').mockResolvedValue(mockOctokit as never);

      await service.dispatchWorkflow({
        installationId: 1001,
        owner: 'owner',
        repo: 'repo',
        workflowFile: 'codaholiq.yml',
        ref: 'main',
        inputs: { prompt: 'Fix the bug' },
      });

      expect(mockOctokit.rest.actions.createWorkflowDispatch).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        workflow_id: 'codaholiq.yml',
        ref: 'main',
        inputs: { prompt: 'Fix the bug' },
      });
    });
  });

  describe('getWorkflowRun', () => {
    it('should return a mapped workflow run', async () => {
      const mockOctokit = {
        rest: {
          actions: {
            getWorkflowRun: vi.fn().mockResolvedValue({
              data: {
                id: 500,
                status: 'completed',
                conclusion: 'success',
                html_url: 'https://github.com/owner/repo/actions/runs/500',
              },
            }),
          },
        },
      };
      vi.spyOn(service, 'getInstallationOctokit').mockResolvedValue(mockOctokit as never);

      const run = await service.getWorkflowRun({
        installationId: 1001,
        owner: 'owner',
        repo: 'repo',
        runId: 500,
      });

      expect(run).toEqual({
        id: 500,
        status: 'completed',
        conclusion: 'success',
        html_url: 'https://github.com/owner/repo/actions/runs/500',
      });
    });
  });

  describe('getWorkflowRunLogs', () => {
    it('should return workflow run logs as ArrayBuffer', async () => {
      const mockBuffer = new ArrayBuffer(8);
      const mockOctokit = {
        rest: {
          actions: {
            downloadWorkflowRunLogs: vi.fn().mockResolvedValue({ data: mockBuffer }),
          },
        },
      };
      vi.spyOn(service, 'getInstallationOctokit').mockResolvedValue(mockOctokit as never);

      const logs = await service.getWorkflowRunLogs({
        installationId: 1001,
        owner: 'owner',
        repo: 'repo',
        runId: 600,
      });

      expect(logs).toBe(mockBuffer);
      expect(mockOctokit.rest.actions.downloadWorkflowRunLogs).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        run_id: 600,
      });
    });
  });

  describe('getBranchRef', () => {
    it('should return ref and sha for a branch', async () => {
      const mockOctokit = {
        rest: {
          git: {
            getRef: vi.fn().mockResolvedValue({
              data: { ref: 'refs/heads/main', object: { sha: 'abc123' } },
            }),
          },
        },
      };
      vi.spyOn(service, 'getInstallationOctokit').mockResolvedValue(mockOctokit as never);

      const result = await service.getBranchRef({
        installationId: 1001,
        owner: 'owner',
        repo: 'repo',
        branch: 'main',
      });

      expect(result).toEqual({ ref: 'refs/heads/main', sha: 'abc123' });
      expect(mockOctokit.rest.git.getRef).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        ref: 'heads/main',
      });
    });
  });

  describe('createBranchRef', () => {
    it('should create a branch and return ref', async () => {
      const mockOctokit = {
        rest: {
          git: {
            createRef: vi.fn().mockResolvedValue({
              data: { ref: 'refs/heads/codaholiq/add-workflow', object: { sha: 'abc123' } },
            }),
          },
        },
      };
      vi.spyOn(service, 'getInstallationOctokit').mockResolvedValue(mockOctokit as never);

      const result = await service.createBranchRef({
        installationId: 1001,
        owner: 'owner',
        repo: 'repo',
        branch: 'codaholiq/add-workflow',
        sha: 'abc123',
      });

      expect(result).toEqual({ ref: 'refs/heads/codaholiq/add-workflow', sha: 'abc123' });
      expect(mockOctokit.rest.git.createRef).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        ref: 'refs/heads/codaholiq/add-workflow',
        sha: 'abc123',
      });
    });
  });

  describe('deleteBranchRef', () => {
    it('should delete a branch ref', async () => {
      const mockOctokit = {
        rest: {
          git: {
            deleteRef: vi.fn().mockResolvedValue({}),
          },
        },
      };
      vi.spyOn(service, 'getInstallationOctokit').mockResolvedValue(mockOctokit as never);

      await service.deleteBranchRef({
        installationId: 1001,
        owner: 'owner',
        repo: 'repo',
        branch: 'codaholiq/add-workflow',
      });

      expect(mockOctokit.rest.git.deleteRef).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        ref: 'heads/codaholiq/add-workflow',
      });
    });
  });

  describe('createOrUpdateFileContents', () => {
    it('should commit a file with base64-encoded content', async () => {
      const mockOctokit = {
        rest: {
          repos: {
            createOrUpdateFileContents: vi.fn().mockResolvedValue({
              data: {
                commit: {
                  sha: 'commit-sha-456',
                  html_url: 'https://github.com/owner/repo/commit/commit-sha-456',
                },
              },
            }),
          },
        },
      };
      vi.spyOn(service, 'getInstallationOctokit').mockResolvedValue(mockOctokit as never);

      const result = await service.createOrUpdateFileContents({
        installationId: 1001,
        owner: 'owner',
        repo: 'repo',
        path: '.github/workflows/codaholiq.yml',
        message: 'Add workflow',
        content: 'name: Codaholiq',
        branch: 'codaholiq/add-workflow',
      });

      expect(result).toEqual({
        sha: 'commit-sha-456',
        htmlUrl: 'https://github.com/owner/repo/commit/commit-sha-456',
      });
      expect(mockOctokit.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        path: '.github/workflows/codaholiq.yml',
        message: 'Add workflow',
        content: Buffer.from('name: Codaholiq').toString('base64'),
        branch: 'codaholiq/add-workflow',
      });
    });
  });

  describe('createPullRequest', () => {
    it('should create a pull request and return details', async () => {
      const mockOctokit = {
        rest: {
          pulls: {
            create: vi.fn().mockResolvedValue({
              data: {
                number: 42,
                html_url: 'https://github.com/owner/repo/pull/42',
                title: 'Add Codaholiq workflow',
              },
            }),
          },
        },
      };
      vi.spyOn(service, 'getInstallationOctokit').mockResolvedValue(mockOctokit as never);

      const result = await service.createPullRequest({
        installationId: 1001,
        owner: 'owner',
        repo: 'repo',
        title: 'Add Codaholiq workflow',
        body: 'PR body',
        head: 'codaholiq/add-workflow',
        base: 'main',
      });

      expect(result).toEqual({
        number: 42,
        htmlUrl: 'https://github.com/owner/repo/pull/42',
        title: 'Add Codaholiq workflow',
      });
      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        title: 'Add Codaholiq workflow',
        body: 'PR body',
        head: 'codaholiq/add-workflow',
        base: 'main',
      });
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
      mockRedis.get.mockResolvedValue('enc:cached-token');
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

  describe('listRepositorySecrets', () => {
    it('should return secret names', async () => {
      const mockOctokit = {
        rest: {
          actions: {
            listRepoSecrets: vi.fn().mockResolvedValue({
              data: {
                total_count: 2,
                secrets: [
                  { name: 'ANTHROPIC_API_KEY', created_at: '', updated_at: '' },
                  { name: 'DEPLOY_TOKEN', created_at: '', updated_at: '' },
                ],
              },
            }),
          },
        },
      };
      vi.spyOn(service, 'getInstallationOctokit').mockResolvedValue(mockOctokit as never);

      const result = await service.listRepositorySecrets({
        installationId: 1001,
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toEqual(['ANTHROPIC_API_KEY', 'DEPLOY_TOKEN']);
      expect(mockOctokit.rest.actions.listRepoSecrets).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        per_page: 100,
      });
    });

    it('should return empty array on 403 (no secrets:read permission)', async () => {
      const error = new Error('Forbidden') as Error & { status: number };
      error.status = 403;
      const mockOctokit = {
        rest: {
          actions: {
            listRepoSecrets: vi.fn().mockRejectedValue(error),
          },
        },
      };
      vi.spyOn(service, 'getInstallationOctokit').mockResolvedValue(mockOctokit as never);

      const result = await service.listRepositorySecrets({
        installationId: 1001,
        owner: 'owner',
        repo: 'repo',
      });

      expect(result).toEqual([]);
    });

    it('should rethrow non-403 errors', async () => {
      const error = new Error('Server Error') as Error & { status: number };
      error.status = 500;
      const mockOctokit = {
        rest: {
          actions: {
            listRepoSecrets: vi.fn().mockRejectedValue(error),
          },
        },
      };
      vi.spyOn(service, 'getInstallationOctokit').mockResolvedValue(mockOctokit as never);

      await expect(
        service.listRepositorySecrets({
          installationId: 1001,
          owner: 'owner',
          repo: 'repo',
        }),
      ).rejects.toThrow('Server Error');
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
      mockRedis.get.mockResolvedValue('enc:cached-token');
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
