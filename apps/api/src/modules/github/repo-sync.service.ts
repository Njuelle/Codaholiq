import { Injectable, Inject, Logger } from '@nestjs/common';
import { GitHubApiService, type GitHubRepository } from './github-api.service';
import { GitHubEntityRepository } from './github-entity.repository';

@Injectable()
export class RepoSyncService {
  private readonly logger = new Logger(RepoSyncService.name);

  constructor(
    @Inject(GitHubApiService)
    private readonly githubApi: GitHubApiService,
    @Inject(GitHubEntityRepository)
    private readonly githubRepo: GitHubEntityRepository,
  ) {}

  async syncAllForInstallation({
    installationId,
    orgId,
    dbInstallationId,
  }: {
    installationId: number;
    orgId: number;
    dbInstallationId: number;
  }): Promise<number> {
    const repos = await this.githubApi.listRepositories({ installationId });

    for (const repo of repos) {
      await this.upsertFromGitHub({ repo, orgId, dbInstallationId });
    }

    this.logger.log(`Synced ${repos.length} repositories for installation ${installationId}`);
    return repos.length;
  }

  async syncSingleRepo({
    installationId,
    orgId,
    dbInstallationId,
    owner,
    repo,
  }: {
    installationId: number;
    orgId: number;
    dbInstallationId: number;
    owner: string;
    repo: string;
  }): Promise<void> {
    const repoData = await this.githubApi.getRepository({
      installationId,
      owner,
      repo,
    });

    await this.upsertFromGitHub({
      repo: repoData,
      orgId,
      dbInstallationId,
    });
  }

  private async upsertFromGitHub({
    repo,
    orgId,
    dbInstallationId,
  }: {
    repo: GitHubRepository;
    orgId: number;
    dbInstallationId: number;
  }): Promise<void> {
    await this.githubRepo.upsertRepository({
      githubId: repo.id,
      installationId: dbInstallationId,
      orgId,
      owner: repo.owner.login,
      name: repo.name,
      fullName: repo.full_name,
      defaultBranch: repo.default_branch,
      isPrivate: repo.private,
      language: repo.language,
      archived: repo.archived,
    });
  }
}
