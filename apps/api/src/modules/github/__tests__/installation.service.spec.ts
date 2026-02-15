import { InstallationService } from '../installation.service';
import type { GitHubEntityRepository } from '../github-entity.repository';
import type { AutomationRepository } from '../../automations/automations.repository';
import type { OrganizationsRepository } from '../../organizations/organizations.repository';
import type { RepoSyncService } from '../repo-sync.service';

function createMockGitHubRepo(): Record<string, ReturnType<typeof vi.fn>> {
  return {
    upsertInstallation: vi.fn().mockResolvedValue({ id: 1, orgId: 10 }),
    deleteInstallation: vi.fn().mockResolvedValue(undefined),
    findInstallationByGitHubId: vi.fn().mockResolvedValue(undefined),
    updateInstallationSuspension: vi.fn().mockResolvedValue(undefined),
    upsertRepository: vi.fn().mockResolvedValue({}),
    findRepositoriesByInstallationId: vi.fn().mockResolvedValue([]),
    findRepositoryByFullName: vi.fn().mockResolvedValue(undefined),
    deactivateRepositoriesByIds: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockAutomationRepo(): Record<string, ReturnType<typeof vi.fn>> {
  return {
    disableByRepoIds: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockOrgRepo(): Record<string, ReturnType<typeof vi.fn>> {
  return {
    findOrgBySlug: vi.fn().mockResolvedValue(undefined),
    createOrg: vi.fn().mockResolvedValue({ id: 10, name: 'acme', slug: 'acme' }),
  };
}

function createMockRepoSync(): Record<string, ReturnType<typeof vi.fn>> {
  return {
    syncAllForInstallation: vi.fn().mockResolvedValue(0),
  };
}

describe('InstallationService', () => {
  let service: InstallationService;
  let mockGitHubRepo: ReturnType<typeof createMockGitHubRepo>;
  let mockAutomationRepo: ReturnType<typeof createMockAutomationRepo>;
  let mockOrgRepo: ReturnType<typeof createMockOrgRepo>;
  let mockRepoSync: ReturnType<typeof createMockRepoSync>;

  beforeEach(() => {
    mockGitHubRepo = createMockGitHubRepo();
    mockAutomationRepo = createMockAutomationRepo();
    mockOrgRepo = createMockOrgRepo();
    mockRepoSync = createMockRepoSync();

    service = new InstallationService(
      mockGitHubRepo as unknown as GitHubEntityRepository,
      mockAutomationRepo as unknown as AutomationRepository,
      mockOrgRepo as unknown as OrganizationsRepository,
      mockRepoSync as unknown as RepoSyncService,
    );
  });

  describe('handleInstallationCreated', () => {
    it('should create org if not found and upsert installation', async () => {
      mockGitHubRepo.upsertInstallation.mockResolvedValue({
        id: 1,
        orgId: 10,
        installationId: 50001,
      });

      await service.handleInstallationCreated({
        payload: {
          installation: {
            id: 50001,
            account: { login: 'Acme-Corp', type: 'Organization' },
          },
          repositories: [
            { id: 100, name: 'repo-a', full_name: 'Acme-Corp/repo-a', private: false },
          ],
        },
      });

      expect(mockOrgRepo.findOrgBySlug).toHaveBeenCalledWith({
        slug: 'acme-corp',
      });
      expect(mockOrgRepo.createOrg).toHaveBeenCalledWith({
        name: 'Acme-Corp',
        slug: 'acme-corp',
      });
      expect(mockGitHubRepo.upsertInstallation).toHaveBeenCalledWith(
        expect.objectContaining({
          installationId: 50001,
          accountLogin: 'Acme-Corp',
          accountType: 'Organization',
        }),
      );
      expect(mockGitHubRepo.upsertRepository).toHaveBeenCalledOnce();
    });

    it('should trigger full sync after initial repo upsert from payload', async () => {
      mockGitHubRepo.upsertInstallation.mockResolvedValue({
        id: 1,
        orgId: 10,
        installationId: 50001,
      });

      await service.handleInstallationCreated({
        payload: {
          installation: {
            id: 50001,
            account: { login: 'Acme-Corp', type: 'Organization' },
          },
          repositories: [
            { id: 100, name: 'repo-a', full_name: 'Acme-Corp/repo-a', private: false },
          ],
        },
      });

      expect(mockRepoSync.syncAllForInstallation).toHaveBeenCalledWith({
        installationId: 50001,
        orgId: 10,
        dbInstallationId: 1,
      });
    });

    it('should reuse existing org by slug match', async () => {
      mockOrgRepo.findOrgBySlug.mockResolvedValue({
        id: 20,
        name: 'Acme',
        slug: 'acme',
      });
      mockGitHubRepo.upsertInstallation.mockResolvedValue({
        id: 2,
        orgId: 20,
        installationId: 50002,
      });

      await service.handleInstallationCreated({
        payload: {
          installation: {
            id: 50002,
            account: { login: 'acme', type: 'Organization' },
          },
          repositories: [],
        },
      });

      expect(mockOrgRepo.createOrg).not.toHaveBeenCalled();
      expect(mockGitHubRepo.upsertInstallation).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: 20 }),
      );
    });

    it('should sync via API when no repositories in payload', async () => {
      mockOrgRepo.findOrgBySlug.mockResolvedValue({ id: 30, name: 'foo', slug: 'foo' });
      mockGitHubRepo.upsertInstallation.mockResolvedValue({
        id: 3,
        orgId: 30,
        installationId: 50003,
      });

      await service.handleInstallationCreated({
        payload: {
          installation: {
            id: 50003,
            account: { login: 'foo', type: 'User' },
          },
        },
      });

      expect(mockRepoSync.syncAllForInstallation).toHaveBeenCalledWith({
        installationId: 50003,
        orgId: 30,
        dbInstallationId: 3,
      });
      expect(mockGitHubRepo.upsertRepository).not.toHaveBeenCalled();
    });

    it('should throw on invalid payload', async () => {
      await expect(
        service.handleInstallationCreated({
          payload: { missing: 'installation' },
        }),
      ).rejects.toThrow();
    });
  });

  describe('handleInstallationDeleted', () => {
    it('should disable automations and delete installation', async () => {
      mockGitHubRepo.findInstallationByGitHubId.mockResolvedValue({
        id: 5,
        installationId: 60001,
        orgId: 40,
      });
      mockGitHubRepo.findRepositoriesByInstallationId.mockResolvedValue([{ id: 101 }, { id: 102 }]);

      await service.handleInstallationDeleted({
        payload: {
          installation: {
            id: 60001,
            account: { login: 'acme', type: 'Organization' },
          },
        },
      });

      expect(mockAutomationRepo.disableByRepoIds).toHaveBeenCalledWith({
        repoIds: [101, 102],
      });
      expect(mockGitHubRepo.deleteInstallation).toHaveBeenCalledWith({
        installationId: 60001,
      });
    });

    it('should handle installation not found gracefully', async () => {
      mockGitHubRepo.findInstallationByGitHubId.mockResolvedValue(undefined);

      await service.handleInstallationDeleted({
        payload: {
          installation: {
            id: 99999,
            account: { login: 'missing', type: 'Organization' },
          },
        },
      });

      expect(mockAutomationRepo.disableByRepoIds).not.toHaveBeenCalled();
      expect(mockGitHubRepo.deleteInstallation).not.toHaveBeenCalled();
    });
  });

  describe('handleInstallationSuspended', () => {
    it('should set suspendedAt on the installation', async () => {
      await service.handleInstallationSuspended({
        payload: {
          installation: {
            id: 70001,
            account: { login: 'acme', type: 'Organization' },
          },
        },
      });

      expect(mockGitHubRepo.updateInstallationSuspension).toHaveBeenCalledWith({
        installationId: 70001,
        suspendedAt: expect.any(Date),
      });
    });
  });

  describe('handleInstallationUnsuspended', () => {
    it('should clear suspendedAt on the installation', async () => {
      await service.handleInstallationUnsuspended({
        payload: {
          installation: {
            id: 70002,
            account: { login: 'acme', type: 'Organization' },
          },
        },
      });

      expect(mockGitHubRepo.updateInstallationSuspension).toHaveBeenCalledWith({
        installationId: 70002,
        suspendedAt: null,
      });
    });
  });

  describe('handleRepositoriesAdded', () => {
    it('should upsert added repositories', async () => {
      mockGitHubRepo.findInstallationByGitHubId.mockResolvedValue({
        id: 8,
        installationId: 80001,
        orgId: 50,
      });

      await service.handleRepositoriesAdded({
        payload: {
          installation: {
            id: 80001,
            account: { login: 'acme', type: 'Organization' },
          },
          repositories_added: [
            { id: 200, name: 'new-repo', full_name: 'acme/new-repo', private: true },
            { id: 201, name: 'other-repo', full_name: 'acme/other-repo', private: false },
          ],
        },
      });

      expect(mockGitHubRepo.upsertRepository).toHaveBeenCalledTimes(2);
      expect(mockGitHubRepo.upsertRepository).toHaveBeenCalledWith(
        expect.objectContaining({
          githubId: 200,
          installationId: 8,
          orgId: 50,
          name: 'new-repo',
          isPrivate: true,
        }),
      );
    });

    it('should handle installation not found gracefully', async () => {
      mockGitHubRepo.findInstallationByGitHubId.mockResolvedValue(undefined);

      await service.handleRepositoriesAdded({
        payload: {
          installation: {
            id: 99999,
            account: { login: 'missing', type: 'Organization' },
          },
          repositories_added: [
            { id: 300, name: 'repo', full_name: 'missing/repo', private: false },
          ],
        },
      });

      expect(mockGitHubRepo.upsertRepository).not.toHaveBeenCalled();
    });
  });

  describe('handleRepositoriesRemoved', () => {
    it('should disable automations and deactivate removed repos', async () => {
      mockGitHubRepo.findInstallationByGitHubId.mockResolvedValue({
        id: 9,
        installationId: 90001,
        orgId: 60,
      });
      mockGitHubRepo.findRepositoryByFullName
        .mockResolvedValueOnce({ id: 301 })
        .mockResolvedValueOnce({ id: 302 });

      await service.handleRepositoriesRemoved({
        payload: {
          installation: {
            id: 90001,
            account: { login: 'acme', type: 'Organization' },
          },
          repositories_removed: [
            { id: 400, name: 'old-repo', full_name: 'acme/old-repo' },
            { id: 401, name: 'dead-repo', full_name: 'acme/dead-repo' },
          ],
        },
      });

      expect(mockGitHubRepo.findRepositoryByFullName).toHaveBeenCalledWith({
        fullName: 'acme/old-repo',
        orgId: 60,
      });
      expect(mockAutomationRepo.disableByRepoIds).toHaveBeenCalledWith({
        repoIds: [301, 302],
      });
      expect(mockGitHubRepo.deactivateRepositoriesByIds).toHaveBeenCalledWith({
        repoIds: [301, 302],
      });
    });

    it('should skip repos not found in DB', async () => {
      mockGitHubRepo.findInstallationByGitHubId.mockResolvedValue({
        id: 9,
        installationId: 90002,
        orgId: 60,
      });
      mockGitHubRepo.findRepositoryByFullName
        .mockResolvedValueOnce({ id: 303 })
        .mockResolvedValueOnce(undefined);

      await service.handleRepositoriesRemoved({
        payload: {
          installation: {
            id: 90002,
            account: { login: 'acme', type: 'Organization' },
          },
          repositories_removed: [
            { id: 500, name: 'known', full_name: 'acme/known' },
            { id: 501, name: 'unknown', full_name: 'acme/unknown' },
          ],
        },
      });

      expect(mockAutomationRepo.disableByRepoIds).toHaveBeenCalledWith({
        repoIds: [303],
      });
    });

    it('should handle installation not found gracefully', async () => {
      mockGitHubRepo.findInstallationByGitHubId.mockResolvedValue(undefined);

      await service.handleRepositoriesRemoved({
        payload: {
          installation: {
            id: 99999,
            account: { login: 'missing', type: 'Organization' },
          },
          repositories_removed: [{ id: 600, name: 'repo', full_name: 'missing/repo' }],
        },
      });

      expect(mockGitHubRepo.findRepositoryByFullName).not.toHaveBeenCalled();
      expect(mockAutomationRepo.disableByRepoIds).not.toHaveBeenCalled();
    });
  });
});
