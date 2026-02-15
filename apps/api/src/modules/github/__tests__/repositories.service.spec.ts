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
    name: 'test-repo',
    fullName: 'owner/test-repo',
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

  describe('getSetupStatus', () => {
    it('should return workflowFileExists true when file exists', async () => {
      repoRepo.findRepositoryById.mockResolvedValue(makeRepo({ owner: 'acme', name: 'app' }));
      repoRepo.findInstallationByOrgId.mockResolvedValue({ id: 1, installationId: 5001 });
      githubApiService.checkFileExists.mockResolvedValue(true);

      const result = await service.getSetupStatus({ orgId: 10, repoId: 1 });

      expect(result.workflowFileExists).toBe(true);
      expect(githubApiService.checkFileExists).toHaveBeenCalledWith({
        installationId: 5001,
        owner: 'acme',
        repo: 'app',
        path: '.github/workflows/codaholiq.yml',
      });
    });

    it('should return workflowFileExists false when file does not exist', async () => {
      repoRepo.findRepositoryById.mockResolvedValue(makeRepo());
      repoRepo.findInstallationByOrgId.mockResolvedValue({ id: 1, installationId: 5001 });
      githubApiService.checkFileExists.mockResolvedValue(false);

      const result = await service.getSetupStatus({ orgId: 10, repoId: 1 });

      expect(result.workflowFileExists).toBe(false);
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
