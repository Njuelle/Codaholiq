import { RepoSyncService } from '../repo-sync.service';
import type { GitHubApiService, GitHubRepository } from '../github-api.service';
import type { GitHubEntityRepository } from '../github-entity.repository';

function createMockGitHubApi(): Record<string, ReturnType<typeof vi.fn>> {
  return {
    listRepositories: vi.fn().mockResolvedValue([]),
    getRepository: vi.fn(),
  };
}

function createMockGitHubRepo(): Record<string, ReturnType<typeof vi.fn>> {
  return {
    upsertRepository: vi.fn().mockResolvedValue({}),
  };
}

function makeGitHubRepo(overrides: Partial<GitHubRepository> = {}): GitHubRepository {
  return {
    id: 100001,
    name: 'my-repo',
    full_name: 'acme/my-repo',
    owner: { login: 'acme' },
    default_branch: 'main',
    private: false,
    language: 'TypeScript',
    archived: false,
    ...overrides,
  };
}

describe('RepoSyncService', () => {
  let service: RepoSyncService;
  let mockGitHubApi: ReturnType<typeof createMockGitHubApi>;
  let mockGitHubRepo: ReturnType<typeof createMockGitHubRepo>;

  beforeEach(() => {
    mockGitHubApi = createMockGitHubApi();
    mockGitHubRepo = createMockGitHubRepo();

    service = new RepoSyncService(
      mockGitHubApi as unknown as GitHubApiService,
      mockGitHubRepo as unknown as GitHubEntityRepository,
    );
  });

  describe('syncAllForInstallation', () => {
    it('should fetch repos from API and upsert each one', async () => {
      const repos = [
        makeGitHubRepo({ id: 1, name: 'repo-a', full_name: 'acme/repo-a' }),
        makeGitHubRepo({ id: 2, name: 'repo-b', full_name: 'acme/repo-b' }),
      ];
      mockGitHubApi.listRepositories.mockResolvedValue(repos);

      const count = await service.syncAllForInstallation({
        installationId: 5001,
        orgId: 10,
        dbInstallationId: 20,
      });

      expect(count).toBe(2);
      expect(mockGitHubApi.listRepositories).toHaveBeenCalledWith({
        installationId: 5001,
      });
      expect(mockGitHubRepo.upsertRepository).toHaveBeenCalledTimes(2);
      expect(mockGitHubRepo.upsertRepository).toHaveBeenCalledWith(
        expect.objectContaining({
          githubId: 1,
          installationId: 20,
          orgId: 10,
          name: 'repo-a',
          fullName: 'acme/repo-a',
        }),
      );
    });

    it('should return 0 for empty repository list', async () => {
      mockGitHubApi.listRepositories.mockResolvedValue([]);

      const count = await service.syncAllForInstallation({
        installationId: 5002,
        orgId: 10,
        dbInstallationId: 20,
      });

      expect(count).toBe(0);
      expect(mockGitHubRepo.upsertRepository).not.toHaveBeenCalled();
    });
  });

  describe('syncSingleRepo', () => {
    it('should fetch a single repo from API and upsert it', async () => {
      const repo = makeGitHubRepo({
        id: 3,
        name: 'single-repo',
        full_name: 'acme/single-repo',
        private: true,
        language: 'Go',
      });
      mockGitHubApi.getRepository.mockResolvedValue(repo);

      await service.syncSingleRepo({
        installationId: 6001,
        orgId: 11,
        dbInstallationId: 21,
        owner: 'acme',
        repo: 'single-repo',
      });

      expect(mockGitHubApi.getRepository).toHaveBeenCalledWith({
        installationId: 6001,
        owner: 'acme',
        repo: 'single-repo',
      });
      expect(mockGitHubRepo.upsertRepository).toHaveBeenCalledWith(
        expect.objectContaining({
          githubId: 3,
          installationId: 21,
          orgId: 11,
          name: 'single-repo',
          fullName: 'acme/single-repo',
          isPrivate: true,
          language: 'Go',
        }),
      );
    });
  });
});
