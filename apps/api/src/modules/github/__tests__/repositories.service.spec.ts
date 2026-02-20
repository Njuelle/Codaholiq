import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RepositoriesService } from '../repositories.service';
import type { GitHubEntityRepository } from '../github-entity.repository';
import type { GitHubApiService } from '../github-api.service';
import type { RepoSyncService } from '../repo-sync.service';
import type { AutomationService } from '../../automations/automations.service';

function createMockRepoRepository() {
  return {
    findRepositoriesByOrgId: vi.fn().mockResolvedValue([]),
    countByOrgId: vi.fn().mockResolvedValue(0),
    findRepositoryById: vi.fn(),
    findInstallationByOrgId: vi.fn(),
    setWebhookActive: vi.fn(),
  };
}

function createMockGitHubApiService() {
  return {
    checkFileExists: vi.fn().mockResolvedValue(false),
    listRepositorySecrets: vi.fn().mockResolvedValue([]),
    getBranchRef: vi.fn().mockResolvedValue({ ref: 'refs/heads/main', sha: 'abc123' }),
    createBranchRef: vi.fn().mockResolvedValue({
      ref: 'refs/heads/codaholiq/add-workflow',
      sha: 'abc123',
    }),
    createOrUpdateFileContents: vi.fn().mockResolvedValue({
      sha: 'commit-sha',
      htmlUrl: 'https://github.com/owner/repo/commit/commit-sha',
    }),
    createPullRequest: vi.fn().mockResolvedValue({
      number: 42,
      htmlUrl: 'https://github.com/owner/test-repo/pull/42',
      title: 'Add Codaholiq GitHub Actions workflow',
    }),
    deleteBranchRef: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockRepoSyncService() {
  return {
    syncAllForInstallation: vi.fn().mockResolvedValue(0),
  };
}

function createMockAutomationService() {
  return {
    countByRepoId: vi.fn().mockResolvedValue(0),
  };
}

function makeRepo(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    orgId: 10,
    owner: 'owner',
    name: 'test-repo',
    fullName: 'owner/test-repo',
    defaultBranch: 'main',
    webhookActive: true,
    ...overrides,
  };
}

describe('RepositoriesService', () => {
  let service: RepositoriesService;
  let repoRepo: ReturnType<typeof createMockRepoRepository>;
  let githubApiService: ReturnType<typeof createMockGitHubApiService>;
  let syncService: ReturnType<typeof createMockRepoSyncService>;
  let automationService: ReturnType<typeof createMockAutomationService>;

  beforeEach(() => {
    repoRepo = createMockRepoRepository();
    githubApiService = createMockGitHubApiService();
    syncService = createMockRepoSyncService();
    automationService = createMockAutomationService();
    service = new RepositoriesService(
      repoRepo as unknown as GitHubEntityRepository,
      githubApiService as unknown as GitHubApiService,
      syncService as unknown as RepoSyncService,
      automationService as unknown as AutomationService,
    );
  });

  describe('list', () => {
    it('should return items and total', async () => {
      repoRepo.findRepositoriesByOrgId.mockResolvedValue([makeRepo()]);
      repoRepo.countByOrgId.mockResolvedValue(1);

      const result = await service.list({ orgId: 10, filters: {} });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should pass filters through', async () => {
      repoRepo.findRepositoriesByOrgId.mockResolvedValue([]);
      repoRepo.countByOrgId.mockResolvedValue(0);

      await service.list({
        orgId: 10,
        filters: { search: 'test', language: 'TypeScript', limit: 10 },
      });

      expect(repoRepo.findRepositoriesByOrgId).toHaveBeenCalledWith({
        orgId: 10,
        filters: expect.objectContaining({
          search: 'test',
          language: 'TypeScript',
          limit: 10,
        }),
      });
    });
  });

  describe('findById', () => {
    it('should return repo with automation count', async () => {
      repoRepo.findRepositoryById.mockResolvedValue(makeRepo());
      automationService.countByRepoId.mockResolvedValue(3);

      const result = await service.findById({ orgId: 10, repoId: 1 });

      expect(result.automationCount).toBe(3);
    });

    it('should throw NotFoundException if repo not found', async () => {
      repoRepo.findRepositoryById.mockResolvedValue(undefined);

      await expect(service.findById({ orgId: 10, repoId: 999 })).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if repo belongs to different org', async () => {
      repoRepo.findRepositoryById.mockResolvedValue(makeRepo({ orgId: 20 }));

      await expect(service.findById({ orgId: 10, repoId: 1 })).rejects.toThrow(NotFoundException);
    });
  });

  describe('triggerSync', () => {
    it('should sync repos and return count', async () => {
      repoRepo.findInstallationByOrgId.mockResolvedValue({
        id: 1,
        installationId: 200001,
      });
      syncService.syncAllForInstallation.mockResolvedValue(5);

      const result = await service.triggerSync({ orgId: 10 });

      expect(result.synced).toBe(5);
    });

    it('should throw BadRequestException if no installation', async () => {
      repoRepo.findInstallationByOrgId.mockResolvedValue(undefined);

      await expect(service.triggerSync({ orgId: 10 })).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateWebhookActive', () => {
    it('should update and return repo', async () => {
      repoRepo.findRepositoryById.mockResolvedValue(makeRepo());
      repoRepo.setWebhookActive.mockResolvedValue(makeRepo({ webhookActive: false }));

      const result = await service.updateWebhookActive({
        orgId: 10,
        repoId: 1,
        active: false,
      });

      expect(result.webhookActive).toBe(false);
      expect(repoRepo.setWebhookActive).toHaveBeenCalledWith({
        repoId: 1,
        active: false,
      });
    });

    it('should throw NotFoundException if repo not found', async () => {
      repoRepo.findRepositoryById.mockResolvedValue(undefined);

      await expect(
        service.updateWebhookActive({ orgId: 10, repoId: 999, active: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('setupWorkflowPR', () => {
    it('should create PR and return URL', async () => {
      repoRepo.findRepositoryById.mockResolvedValue(makeRepo());
      repoRepo.findInstallationByOrgId.mockResolvedValue({ id: 1, installationId: 5001 });
      githubApiService.checkFileExists.mockResolvedValue(false);

      const result = await service.setupWorkflowPR({ orgId: 10, repoId: 1 });

      expect(result).toEqual({
        pullRequestUrl: 'https://github.com/owner/test-repo/pull/42',
      });
      expect(githubApiService.getBranchRef).toHaveBeenCalledWith(
        expect.objectContaining({ branch: 'main', owner: 'owner', repo: 'test-repo' }),
      );
      expect(githubApiService.createBranchRef).toHaveBeenCalledWith(
        expect.objectContaining({ branch: 'codaholiq/add-workflow', sha: 'abc123' }),
      );
      expect(githubApiService.createOrUpdateFileContents).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '.github/workflows/codaholiq.yml',
          branch: 'codaholiq/add-workflow',
        }),
      );
      expect(githubApiService.createPullRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          head: 'codaholiq/add-workflow',
          base: 'main',
        }),
      );
    });

    it('should throw NotFoundException if repo not found', async () => {
      repoRepo.findRepositoryById.mockResolvedValue(undefined);

      await expect(service.setupWorkflowPR({ orgId: 10, repoId: 999 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if repo belongs to different org', async () => {
      repoRepo.findRepositoryById.mockResolvedValue(makeRepo({ orgId: 20 }));

      await expect(service.setupWorkflowPR({ orgId: 10, repoId: 1 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if no installation found', async () => {
      repoRepo.findRepositoryById.mockResolvedValue(makeRepo());
      repoRepo.findInstallationByOrgId.mockResolvedValue(undefined);

      await expect(service.setupWorkflowPR({ orgId: 10, repoId: 1 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if workflow file already exists', async () => {
      repoRepo.findRepositoryById.mockResolvedValue(makeRepo());
      repoRepo.findInstallationByOrgId.mockResolvedValue({ id: 1, installationId: 5001 });
      githubApiService.checkFileExists.mockResolvedValue(true);

      await expect(service.setupWorkflowPR({ orgId: 10, repoId: 1 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if branch already exists (422)', async () => {
      repoRepo.findRepositoryById.mockResolvedValue(makeRepo());
      repoRepo.findInstallationByOrgId.mockResolvedValue({ id: 1, installationId: 5001 });
      githubApiService.checkFileExists.mockResolvedValue(false);
      const error = new Error('Reference already exists') as Error & { status: number };
      error.status = 422;
      githubApiService.createBranchRef.mockRejectedValue(error);

      await expect(service.setupWorkflowPR({ orgId: 10, repoId: 1 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should clean up branch if createPullRequest fails', async () => {
      repoRepo.findRepositoryById.mockResolvedValue(makeRepo());
      repoRepo.findInstallationByOrgId.mockResolvedValue({ id: 1, installationId: 5001 });
      githubApiService.checkFileExists.mockResolvedValue(false);
      githubApiService.createPullRequest.mockRejectedValue(new Error('PR creation failed'));

      await expect(service.setupWorkflowPR({ orgId: 10, repoId: 1 })).rejects.toThrow(
        'PR creation failed',
      );

      expect(githubApiService.deleteBranchRef).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'owner',
          repo: 'test-repo',
          branch: 'codaholiq/add-workflow',
        }),
      );
    });

    it('should still throw original error if branch cleanup also fails', async () => {
      repoRepo.findRepositoryById.mockResolvedValue(makeRepo());
      repoRepo.findInstallationByOrgId.mockResolvedValue({ id: 1, installationId: 5001 });
      githubApiService.checkFileExists.mockResolvedValue(false);
      githubApiService.createOrUpdateFileContents.mockRejectedValue(new Error('Commit failed'));
      githubApiService.deleteBranchRef.mockRejectedValue(new Error('Cleanup failed'));

      await expect(service.setupWorkflowPR({ orgId: 10, repoId: 1 })).rejects.toThrow(
        'Commit failed',
      );

      expect(githubApiService.deleteBranchRef).toHaveBeenCalled();
    });
  });

  describe('getSetupStatus', () => {
    it('should return workflowFileExists true when file exists', async () => {
      repoRepo.findRepositoryById.mockResolvedValue(makeRepo({ owner: 'acme', name: 'app' }));
      repoRepo.findInstallationByOrgId.mockResolvedValue({ id: 1, installationId: 5001 });
      githubApiService.checkFileExists.mockResolvedValue(true);
      githubApiService.listRepositorySecrets.mockResolvedValue(['ANTHROPIC_API_KEY']);

      const result = await service.getSetupStatus({ orgId: 10, repoId: 1 });

      expect(result.workflowFileExists).toBe(true);
      expect(githubApiService.checkFileExists).toHaveBeenCalledWith({
        installationId: 5001,
        owner: 'acme',
        repo: 'app',
        path: '.github/workflows/codaholiq.yml',
      });
      expect(githubApiService.listRepositorySecrets).toHaveBeenCalledWith({
        installationId: 5001,
        owner: 'acme',
        repo: 'app',
      });
    });

    it('should return workflowFileExists false when file does not exist', async () => {
      repoRepo.findRepositoryById.mockResolvedValue(makeRepo());
      repoRepo.findInstallationByOrgId.mockResolvedValue({ id: 1, installationId: 5001 });
      githubApiService.checkFileExists.mockResolvedValue(false);
      githubApiService.listRepositorySecrets.mockResolvedValue([]);

      const result = await service.getSetupStatus({ orgId: 10, repoId: 1 });

      expect(result.workflowFileExists).toBe(false);
    });

    it('should return secretsConfigured true when ANTHROPIC_API_KEY is set', async () => {
      repoRepo.findRepositoryById.mockResolvedValue(makeRepo());
      repoRepo.findInstallationByOrgId.mockResolvedValue({ id: 1, installationId: 5001 });
      githubApiService.checkFileExists.mockResolvedValue(true);
      githubApiService.listRepositorySecrets.mockResolvedValue(['ANTHROPIC_API_KEY', 'OTHER_KEY']);

      const result = await service.getSetupStatus({ orgId: 10, repoId: 1 });

      expect(result.secretsConfigured).toBe(true);
      expect(result.hasAnthropicKey).toBe(true);
      expect(result.hasOAuthToken).toBe(false);
    });

    it('should return secretsConfigured true when CLAUDE_CODE_OAUTH_TOKEN is set', async () => {
      repoRepo.findRepositoryById.mockResolvedValue(makeRepo());
      repoRepo.findInstallationByOrgId.mockResolvedValue({ id: 1, installationId: 5001 });
      githubApiService.checkFileExists.mockResolvedValue(true);
      githubApiService.listRepositorySecrets.mockResolvedValue(['CLAUDE_CODE_OAUTH_TOKEN']);

      const result = await service.getSetupStatus({ orgId: 10, repoId: 1 });

      expect(result.secretsConfigured).toBe(true);
      expect(result.hasAnthropicKey).toBe(false);
      expect(result.hasOAuthToken).toBe(true);
    });

    it('should return secretsConfigured true when both keys are set', async () => {
      repoRepo.findRepositoryById.mockResolvedValue(makeRepo());
      repoRepo.findInstallationByOrgId.mockResolvedValue({ id: 1, installationId: 5001 });
      githubApiService.checkFileExists.mockResolvedValue(true);
      githubApiService.listRepositorySecrets.mockResolvedValue([
        'ANTHROPIC_API_KEY',
        'CLAUDE_CODE_OAUTH_TOKEN',
      ]);

      const result = await service.getSetupStatus({ orgId: 10, repoId: 1 });

      expect(result.secretsConfigured).toBe(true);
      expect(result.hasAnthropicKey).toBe(true);
      expect(result.hasOAuthToken).toBe(true);
    });

    it('should return secretsConfigured false when no relevant keys are set', async () => {
      repoRepo.findRepositoryById.mockResolvedValue(makeRepo());
      repoRepo.findInstallationByOrgId.mockResolvedValue({ id: 1, installationId: 5001 });
      githubApiService.checkFileExists.mockResolvedValue(true);
      githubApiService.listRepositorySecrets.mockResolvedValue(['UNRELATED_SECRET']);

      const result = await service.getSetupStatus({ orgId: 10, repoId: 1 });

      expect(result.secretsConfigured).toBe(false);
      expect(result.hasAnthropicKey).toBe(false);
      expect(result.hasOAuthToken).toBe(false);
    });

    it('should throw NotFoundException if repo not found', async () => {
      repoRepo.findRepositoryById.mockResolvedValue(undefined);

      await expect(service.getSetupStatus({ orgId: 10, repoId: 999 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if repo belongs to different org', async () => {
      repoRepo.findRepositoryById.mockResolvedValue(makeRepo({ orgId: 20 }));

      await expect(service.getSetupStatus({ orgId: 10, repoId: 1 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if no installation found', async () => {
      repoRepo.findRepositoryById.mockResolvedValue(makeRepo());
      repoRepo.findInstallationByOrgId.mockResolvedValue(undefined);

      await expect(service.getSetupStatus({ orgId: 10, repoId: 1 })).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
