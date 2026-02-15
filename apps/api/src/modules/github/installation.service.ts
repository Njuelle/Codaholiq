import { Injectable, Inject, Logger } from '@nestjs/common';
import { GitHubEntityRepository } from './github-entity.repository';
import { AutomationRepository } from '../automations/automations.repository';
import { OrganizationsRepository } from '../organizations/organizations.repository';
import { RepoSyncService } from './repo-sync.service';
import {
  installationPayloadSchema,
  repositoriesChangedPayloadSchema,
  type InstallationPayload,
  type RepositoriesChangedPayload,
} from '../webhooks/webhooks.schemas';

/** Placeholder used when webhook payload omits default_branch. Corrected on full sync. */
const DEFAULT_BRANCH_PLACEHOLDER = 'main';

@Injectable()
export class InstallationService {
  private readonly logger = new Logger(InstallationService.name);

  constructor(
    @Inject(GitHubEntityRepository)
    private readonly githubRepo: GitHubEntityRepository,
    @Inject(AutomationRepository)
    private readonly automationRepo: AutomationRepository,
    @Inject(OrganizationsRepository)
    private readonly orgRepo: OrganizationsRepository,
    @Inject(RepoSyncService)
    private readonly repoSyncService: RepoSyncService,
  ) {}

  private parseInstallationPayload(payload: Record<string, unknown>): InstallationPayload {
    return installationPayloadSchema.parse(payload);
  }

  private parseRepositoriesChangedPayload(
    payload: Record<string, unknown>,
  ): RepositoriesChangedPayload {
    return repositoriesChangedPayloadSchema.parse(payload);
  }

  async handleInstallationCreated({
    payload,
  }: {
    payload: Record<string, unknown>;
  }): Promise<void> {
    const data = this.parseInstallationPayload(payload);
    const { installation } = data;
    const accountLogin = installation.account.login;
    const slug = accountLogin.toLowerCase();

    let org = await this.orgRepo.findOrgBySlug({ slug });
    if (!org) {
      org = await this.orgRepo.createOrg({ name: accountLogin, slug });
      this.logger.log(`Created new org: ${slug}`);
    }

    const dbInstallation = await this.githubRepo.upsertInstallation({
      installationId: installation.id,
      orgId: org.id,
      accountLogin,
      accountType: installation.account.type,
    });

    if (data.repositories && data.repositories.length > 0) {
      for (const repo of data.repositories) {
        const [owner, name] = repo.full_name.split('/');
        await this.githubRepo.upsertRepository({
          githubId: repo.id,
          installationId: dbInstallation.id,
          orgId: org.id,
          owner,
          name,
          fullName: repo.full_name,
          defaultBranch: DEFAULT_BRANCH_PLACEHOLDER,
          isPrivate: repo.private,
          language: null,
          archived: false,
        });
      }
      this.logger.log(`Synced ${data.repositories.length} repos from installation payload`);
    } else {
      await this.repoSyncService.syncAllForInstallation({
        installationId: installation.id,
        orgId: org.id,
        dbInstallationId: dbInstallation.id,
      });
    }

    // Trigger a full sync to fill in accurate metadata (default_branch, language, etc.)
    if (data.repositories && data.repositories.length > 0) {
      await this.repoSyncService.syncAllForInstallation({
        installationId: installation.id,
        orgId: org.id,
        dbInstallationId: dbInstallation.id,
      });
    }
  }

  async handleInstallationDeleted({
    payload,
  }: {
    payload: Record<string, unknown>;
  }): Promise<void> {
    const data = this.parseInstallationPayload(payload);
    const { installation } = data;

    const dbInstallation = await this.githubRepo.findInstallationByGitHubId({
      installationId: installation.id,
    });

    if (!dbInstallation) {
      this.logger.warn(`Installation ${installation.id} not found in DB for deletion`);
      return;
    }

    const repos = await this.githubRepo.findRepositoriesByInstallationId({
      installationId: dbInstallation.id,
    });

    const repoIds = repos.map((r) => r.id);
    await this.automationRepo.disableByRepoIds({ repoIds });

    await this.githubRepo.deleteInstallation({
      installationId: installation.id,
    });

    this.logger.log(
      `Deleted installation ${installation.id}, disabled automations for ${repoIds.length} repos`,
    );
  }

  async handleInstallationSuspended({
    payload,
  }: {
    payload: Record<string, unknown>;
  }): Promise<void> {
    const data = this.parseInstallationPayload(payload);
    await this.githubRepo.updateInstallationSuspension({
      installationId: data.installation.id,
      suspendedAt: new Date(),
    });
    this.logger.log(`Suspended installation ${data.installation.id}`);
  }

  async handleInstallationUnsuspended({
    payload,
  }: {
    payload: Record<string, unknown>;
  }): Promise<void> {
    const data = this.parseInstallationPayload(payload);
    await this.githubRepo.updateInstallationSuspension({
      installationId: data.installation.id,
      suspendedAt: null,
    });
    this.logger.log(`Unsuspended installation ${data.installation.id}`);
  }

  async handleRepositoriesAdded({ payload }: { payload: Record<string, unknown> }): Promise<void> {
    const data = this.parseRepositoriesChangedPayload(payload);
    const { installation } = data;

    const dbInstallation = await this.githubRepo.findInstallationByGitHubId({
      installationId: installation.id,
    });

    if (!dbInstallation) {
      this.logger.warn(`Installation ${installation.id} not found for repositories_added`);
      return;
    }

    const addedRepos = data.repositories_added ?? [];
    for (const repo of addedRepos) {
      const [owner, name] = repo.full_name.split('/');
      await this.githubRepo.upsertRepository({
        githubId: repo.id,
        installationId: dbInstallation.id,
        orgId: dbInstallation.orgId,
        owner,
        name,
        fullName: repo.full_name,
        defaultBranch: DEFAULT_BRANCH_PLACEHOLDER,
        isPrivate: repo.private,
        language: null,
        archived: false,
      });
    }

    this.logger.log(`Added ${addedRepos.length} repos to installation ${installation.id}`);
  }

  async handleRepositoriesRemoved({
    payload,
  }: {
    payload: Record<string, unknown>;
  }): Promise<void> {
    const data = this.parseRepositoriesChangedPayload(payload);
    const { installation } = data;

    const dbInstallation = await this.githubRepo.findInstallationByGitHubId({
      installationId: installation.id,
    });

    if (!dbInstallation) {
      this.logger.warn(`Installation ${installation.id} not found for repositories_removed`);
      return;
    }

    const removedRepos = data.repositories_removed ?? [];

    const repoIds: number[] = [];
    for (const repo of removedRepos) {
      const found = await this.githubRepo.findRepositoryByFullName({
        fullName: repo.full_name,
        orgId: dbInstallation.orgId,
      });
      if (found) {
        repoIds.push(found.id);
      }
    }

    await this.automationRepo.disableByRepoIds({ repoIds });
    await this.githubRepo.deactivateRepositoriesByIds({ repoIds });

    this.logger.log(
      `Removed ${removedRepos.length} repos, disabled automations for ${repoIds.length} repos`,
    );
  }
}
