import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { GitHubEntityRepository } from './github-entity.repository';
import { GitHubApiService } from './github-api.service';
import { RepoSyncService } from './repo-sync.service';
import { AutomationService } from '../automations/automations.service';
import { DEFAULT_WORKFLOW_FILE } from '../automations/automations.schema';
import { WORKFLOW_TEMPLATE } from '../../common/constants/workflow-template';
import { ProvidersRegistry } from '../providers/providers.registry';
import type { ProviderSecretStatus } from '../providers/provider.types';
import { repositories } from './github.schema';
import type { ListReposQuery } from './dto/list-repos.dto';

const WORKFLOW_BRANCH = 'codaholiq/add-workflow';

@Injectable()
export class RepositoriesService {
  private readonly logger = new Logger(RepositoriesService.name);

  constructor(
    @Inject(GitHubEntityRepository)
    private readonly repoRepository: GitHubEntityRepository,
    @Inject(GitHubApiService)
    private readonly githubApiService: GitHubApiService,
    @Inject(RepoSyncService)
    private readonly repoSyncService: RepoSyncService,
    @Inject(AutomationService)
    private readonly automationService: AutomationService,
    @Inject(ProvidersRegistry)
    private readonly providersRegistry: ProvidersRegistry,
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

  async getSetupStatus({ orgId, repoId }: { orgId: number; repoId: number }): Promise<{
    workflowFileExists: boolean;
    secretsConfigured: boolean;
    hasAnthropicKey: boolean;
    hasOAuthToken: boolean;
    providerSecrets: ProviderSecretStatus[];
  }> {
    const repo = await this.repoRepository.findRepositoryById({ id: repoId });
    if (!repo || repo.orgId !== orgId) {
      throw new NotFoundException('Repository not found');
    }

    const installation = await this.repoRepository.findInstallationByOrgId({ orgId });
    if (!installation) {
      throw new BadRequestException('No GitHub App installation found for this organization');
    }

    const [workflowFileExists, secretNames] = await Promise.all([
      this.githubApiService.checkFileExists({
        installationId: installation.installationId,
        owner: repo.owner,
        repo: repo.name,
        path: DEFAULT_WORKFLOW_FILE,
      }),
      this.githubApiService.listRepositorySecrets({
        installationId: installation.installationId,
        owner: repo.owner,
        repo: repo.name,
      }),
    ]);

    const hasAnthropicKey = secretNames.includes('ANTHROPIC_API_KEY');
    const hasOAuthToken = secretNames.includes('CLAUDE_CODE_OAUTH_TOKEN');

    const secretSet = new Set(secretNames);
    const providerSecrets = this.providersRegistry.getAll().map((provider) => {
      const secrets = provider.secrets.map((s) => ({
        name: s.name,
        exists: secretSet.has(s.name),
      }));
      const requiredSecrets = provider.secrets.filter((s) => s.required);
      const configured =
        requiredSecrets.length > 0
          ? requiredSecrets.every((s) => secretSet.has(s.name))
          : secrets.some((s) => s.exists);
      return {
        providerId: provider.id,
        providerName: provider.name,
        configured,
        secrets,
      };
    });

    return {
      workflowFileExists,
      secretsConfigured: hasAnthropicKey || hasOAuthToken,
      hasAnthropicKey,
      hasOAuthToken,
      providerSecrets,
    };
  }

  async setupWorkflowPR({
    orgId,
    repoId,
  }: {
    orgId: number;
    repoId: number;
  }): Promise<{ pullRequestUrl: string }> {
    const repo = await this.repoRepository.findRepositoryById({ id: repoId });
    if (!repo || repo.orgId !== orgId) {
      throw new NotFoundException('Repository not found');
    }

    const installation = await this.repoRepository.findInstallationByOrgId({ orgId });
    if (!installation) {
      throw new BadRequestException('No GitHub App installation found for this organization');
    }

    const fileExists = await this.githubApiService.checkFileExists({
      installationId: installation.installationId,
      owner: repo.owner,
      repo: repo.name,
      path: DEFAULT_WORKFLOW_FILE,
    });
    if (fileExists) {
      throw new BadRequestException('Workflow file already exists in this repository');
    }

    const defaultRef = await this.githubApiService.getBranchRef({
      installationId: installation.installationId,
      owner: repo.owner,
      repo: repo.name,
      branch: repo.defaultBranch,
    });

    try {
      await this.githubApiService.createBranchRef({
        installationId: installation.installationId,
        owner: repo.owner,
        repo: repo.name,
        branch: WORKFLOW_BRANCH,
        sha: defaultRef.sha,
      });
    } catch (err: unknown) {
      if (err instanceof Error && 'status' in err && (err as { status: number }).status === 422) {
        throw new BadRequestException(
          `Branch "${WORKFLOW_BRANCH}" already exists. Please check for an existing PR or delete the branch first.`,
        );
      }
      throw err;
    }

    try {
      await this.githubApiService.createOrUpdateFileContents({
        installationId: installation.installationId,
        owner: repo.owner,
        repo: repo.name,
        path: DEFAULT_WORKFLOW_FILE,
        message: 'Add Codaholiq workflow file',
        content: WORKFLOW_TEMPLATE,
        branch: WORKFLOW_BRANCH,
      });

      const pr = await this.githubApiService.createPullRequest({
        installationId: installation.installationId,
        owner: repo.owner,
        repo: repo.name,
        title: 'Add Codaholiq GitHub Actions workflow',
        body: [
          '## What this PR does',
          '',
          'Adds the Codaholiq workflow file (`.github/workflows/codaholiq.yml`) that enables',
          'AI coding automations to be dispatched from the Codaholiq platform.',
          '',
          'This workflow supports:',
          '- `workflow_dispatch` trigger with `prompt`, `provider`, and `model` inputs',
          '- Automatic dependency installation (npm, yarn, pnpm, bun)',
          '- Multiple AI providers: Claude Code, OpenCode, OpenAI Codex, Gemini CLI',
          '- Conditional provider steps — only the selected provider runs per execution',
          '',
          '---',
          '*Created automatically by Codaholiq*',
        ].join('\n'),
        head: WORKFLOW_BRANCH,
        base: repo.defaultBranch,
      });

      this.logger.log(`Created workflow PR #${pr.number} for ${repo.fullName}`);
      return { pullRequestUrl: pr.htmlUrl };
    } catch (err: unknown) {
      this.logger.warn(
        `Cleaning up branch ${WORKFLOW_BRANCH} after failed PR creation for ${repo.fullName}`,
      );
      try {
        await this.githubApiService.deleteBranchRef({
          installationId: installation.installationId,
          owner: repo.owner,
          repo: repo.name,
          branch: WORKFLOW_BRANCH,
        });
      } catch (cleanupErr: unknown) {
        this.logger.error(
          `Failed to clean up branch ${WORKFLOW_BRANCH} for ${repo.fullName}: ${cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)}`,
        );
      }
      throw err;
    }
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
