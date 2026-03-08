import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { GitHubEntityRepository } from './github-entity.repository';
import { GitHubApiService } from './github-api.service';
import { RepoSyncService } from './repo-sync.service';
import { AutomationService } from '../automations/automations.service';
import { DEFAULT_WORKFLOW_FILE } from '../automations/automations.schema';
import { WorkflowTemplateService } from '../../common/workflow-template/workflow-template.service';
import { ProvidersRegistry } from '../providers/providers.registry';
import type { ProviderSecretStatus } from '../providers/provider.types';
import { repositories } from './github.schema';
import type { ListReposQuery } from './dto/list-repos.dto';

const WORKFLOW_BRANCH = 'codaholiq/add-workflow';
const UPDATE_WORKFLOW_BRANCH = 'codaholiq/update-workflow';

function normalizeContent(content: string): string {
  return content.replace(/\r\n/g, '\n').trimEnd();
}

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
    @Inject(forwardRef(() => AutomationService))
    private readonly automationService: AutomationService,
    @Inject(ProvidersRegistry)
    private readonly providersRegistry: ProvidersRegistry,
    @Inject(WorkflowTemplateService)
    private readonly templateService: WorkflowTemplateService,
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
    workflowFileUpToDate: boolean;
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

    const [fileContent, secretNames, template] = await Promise.all([
      this.githubApiService.getFileContent({
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
      this.templateService.getTemplate(),
    ]);

    const workflowFileExists = fileContent !== null;
    const workflowFileUpToDate = workflowFileExists
      ? normalizeContent(fileContent.content) === normalizeContent(template)
      : false;

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
      workflowFileUpToDate,
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

    const template = await this.templateService.getTemplate();

    return this.createWorkflowBranchAndPR({
      installationId: installation.installationId,
      owner: repo.owner,
      repoName: repo.name,
      fullName: repo.fullName,
      defaultBranch: repo.defaultBranch,
      branch: WORKFLOW_BRANCH,
      template,
      commitMessage: 'Add Codaholiq workflow file',
      prTitle: 'Add Codaholiq GitHub Actions workflow',
      prBody: [
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
    });
  }

  async updateWorkflowPR({
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

    const [fileContent, template] = await Promise.all([
      this.githubApiService.getFileContent({
        installationId: installation.installationId,
        owner: repo.owner,
        repo: repo.name,
        path: DEFAULT_WORKFLOW_FILE,
      }),
      this.templateService.getTemplate(),
    ]);

    if (!fileContent) {
      throw new BadRequestException(
        'Workflow file does not exist. Use the setup endpoint to create it.',
      );
    }

    if (normalizeContent(fileContent.content) === normalizeContent(template)) {
      throw new BadRequestException('Workflow file is already up to date');
    }

    return this.createWorkflowBranchAndPR({
      installationId: installation.installationId,
      owner: repo.owner,
      repoName: repo.name,
      fullName: repo.fullName,
      defaultBranch: repo.defaultBranch,
      branch: UPDATE_WORKFLOW_BRANCH,
      template,
      fileSha: fileContent.sha,
      commitMessage: 'Update Codaholiq workflow file',
      prTitle: 'Update Codaholiq GitHub Actions workflow',
      prBody: [
        '## What this PR does',
        '',
        'Updates the Codaholiq workflow file (`.github/workflows/codaholiq.yml`) to the',
        'latest version from the Codaholiq platform.',
        '',
        'This may include:',
        '- New or updated AI provider steps',
        '- Updated action versions',
        '- Improved workflow configuration',
        '',
        '---',
        '*Created automatically by Codaholiq*',
      ].join('\n'),
    });
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

  private async createWorkflowBranchAndPR({
    installationId,
    owner,
    repoName,
    fullName,
    defaultBranch,
    branch,
    template,
    fileSha,
    commitMessage,
    prTitle,
    prBody,
  }: {
    installationId: number;
    owner: string;
    repoName: string;
    fullName: string;
    defaultBranch: string;
    branch: string;
    template: string;
    fileSha?: string;
    commitMessage: string;
    prTitle: string;
    prBody: string;
  }): Promise<{ pullRequestUrl: string }> {
    const defaultRef = await this.githubApiService.getBranchRef({
      installationId,
      owner,
      repo: repoName,
      branch: defaultBranch,
    });

    try {
      await this.githubApiService.createBranchRef({
        installationId,
        owner,
        repo: repoName,
        branch,
        sha: defaultRef.sha,
      });
    } catch (err: unknown) {
      if (err instanceof Error && 'status' in err && (err as { status: number }).status === 422) {
        throw new BadRequestException(
          `Branch "${branch}" already exists. Please check for an existing PR or delete the branch first.`,
        );
      }
      throw err;
    }

    try {
      await this.githubApiService.createOrUpdateFileContents({
        installationId,
        owner,
        repo: repoName,
        path: DEFAULT_WORKFLOW_FILE,
        message: commitMessage,
        content: template,
        branch,
        ...(fileSha ? { sha: fileSha } : {}),
      });

      const pr = await this.githubApiService.createPullRequest({
        installationId,
        owner,
        repo: repoName,
        title: prTitle,
        body: prBody,
        head: branch,
        base: defaultBranch,
      });

      this.logger.log(`Created workflow PR #${pr.number} for ${fullName}`);
      return { pullRequestUrl: pr.htmlUrl };
    } catch (err: unknown) {
      this.logger.warn(`Cleaning up branch ${branch} after failed PR creation for ${fullName}`);
      try {
        await this.githubApiService.deleteBranchRef({
          installationId,
          owner,
          repo: repoName,
          branch,
        });
      } catch (cleanupErr: unknown) {
        this.logger.error(
          `Failed to clean up branch ${branch} for ${fullName}: ${cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)}`,
        );
      }
      throw err;
    }
  }
}
