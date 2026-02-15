import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { GitHubEntityRepository } from './github-entity.repository';
import { GitHubApiService } from './github-api.service';
import { RepoSyncService } from './repo-sync.service';
import { AutomationService } from '../automations/automations.service';
import { DEFAULT_WORKFLOW_FILE } from '../automations/automations.schema';
import { repositories } from './github.schema';
import type { ListReposQuery } from './dto/list-repos.dto';

@Injectable()
export class RepositoriesService {
  constructor(
    @Inject(GitHubEntityRepository)
    private readonly repoRepository: GitHubEntityRepository,
    @Inject(GitHubApiService)
    private readonly githubApiService: GitHubApiService,
    @Inject(RepoSyncService)
    private readonly repoSyncService: RepoSyncService,
    @Inject(AutomationService)
    private readonly automationService: AutomationService,
  ) {}

  async list({ orgId, filters }: { orgId: number; filters: ListReposQuery }): Promise<{
    items: (typeof repositories.$inferSelect)[];
    total: number;
  }> {
    const filterParams = {
      archived: filters.archived,
      language: filters.language,
      search: filters.search,
      limit: filters.limit,
      offset: filters.offset,
    };

    const [items, total] = await Promise.all([
      this.repoRepository.findRepositoriesByOrgId({ orgId, filters: filterParams }),
      this.repoRepository.countByOrgId({
        orgId,
        filters: {
          archived: filters.archived,
          language: filters.language,
          search: filters.search,
        },
      }),
    ]);

    return { items, total };
  }

  async findById({ orgId, repoId }: { orgId: number; repoId: number }): Promise<{
    repo: typeof repositories.$inferSelect;
    automationCount: number;
  }> {
    const repo = await this.repoRepository.findRepositoryById({ id: repoId });
    if (!repo || repo.orgId !== orgId) {
      throw new NotFoundException('Repository not found');
    }

    const automationCount = await this.automationService.countByRepoId({ repoId });
    return { repo, automationCount };
  }

  async triggerSync({ orgId }: { orgId: number }): Promise<{ synced: number }> {
    const installation = await this.repoRepository.findInstallationByOrgId({ orgId });
    if (!installation) {
      throw new BadRequestException('No GitHub App installation found for this organization');
    }

    const synced = await this.repoSyncService.syncAllForInstallation({
      installationId: installation.installationId,
      orgId,
      dbInstallationId: installation.id,
    });

    return { synced };
  }

  async getSetupStatus({
    orgId,
    repoId,
  }: {
    orgId: number;
    repoId: number;
  }): Promise<{ workflowFileExists: boolean }> {
    const repo = await this.repoRepository.findRepositoryById({ id: repoId });
    if (!repo || repo.orgId !== orgId) {
      throw new NotFoundException('Repository not found');
    }

    const installation = await this.repoRepository.findInstallationByOrgId({ orgId });
    if (!installation) {
      throw new BadRequestException('No GitHub App installation found for this organization');
    }

    const workflowFileExists = await this.githubApiService.checkFileExists({
      installationId: installation.installationId,
      owner: repo.owner,
      repo: repo.name,
      path: DEFAULT_WORKFLOW_FILE,
    });

    return { workflowFileExists };
  }

  async countByOrgId({ orgId }: { orgId: number }): Promise<number> {
    return this.repoRepository.countByOrgId({ orgId });
  }

  async updateWebhookActive({
    orgId,
    repoId,
    active,
  }: {
    orgId: number;
    repoId: number;
    active: boolean;
  }): Promise<typeof repositories.$inferSelect> {
    const repo = await this.repoRepository.findRepositoryById({ id: repoId });
    if (!repo || repo.orgId !== orgId) {
      throw new NotFoundException('Repository not found');
    }

    const updated = await this.repoRepository.setWebhookActive({ repoId, active });
    if (!updated) {
      throw new NotFoundException('Repository not found');
    }
    return updated;
  }
}
