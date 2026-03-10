import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Octokit } from '@octokit/rest';
import { throttling } from '@octokit/plugin-throttling';
import { retry } from '@octokit/plugin-retry';
import * as jwt from 'jsonwebtoken';
import type Redis from 'ioredis';
import { REDIS } from '../redis/redis.constants';
import { EncryptionService } from '../../common/crypto/encryption.service';

const ThrottledOctokit = Octokit.plugin(throttling, retry);

const GITHUB_API_BASE = 'https://api.github.com';
const APP_JWT_EXPIRY_SECONDS = 600;
const TOKEN_CACHE_PREFIX = 'gh:install-token:';

export interface GitHubRepository {
  readonly id: number;
  readonly name: string;
  readonly full_name: string;
  readonly owner: { readonly login: string };
  readonly default_branch: string;
  readonly private: boolean;
  readonly language: string | null;
  readonly archived: boolean;
}

export interface IssueComment {
  readonly login: string;
  readonly body: string;
  readonly createdAt: string;
}

export interface PullRequestReview {
  readonly login: string;
  readonly body: string;
  readonly state: string;
  readonly createdAt: string;
}

export interface WorkflowRun {
  readonly id: number;
  readonly status: string | null;
  readonly conclusion: string | null;
  readonly html_url: string;
}

export interface GitHubRef {
  readonly ref: string;
  readonly sha: string;
}

export interface GitHubFileContent {
  readonly content: string;
  readonly sha: string;
}

export interface GitHubFileCommit {
  readonly sha: string;
  readonly htmlUrl: string;
}

export interface GitHubPullRequest {
  readonly number: number;
  readonly htmlUrl: string;
  readonly title: string;
}

@Injectable()
export class GitHubApiService {
  private readonly logger = new Logger(GitHubApiService.name);
  private readonly redis: Redis;
  private readonly appId: string;
  private readonly privateKey: string;

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(REDIS) redis: Redis,
    @Inject(EncryptionService) private readonly encryption: EncryptionService,
  ) {
    this.appId = this.configService.getOrThrow<string>('GITHUB_APP_ID');
    const rawKey = this.configService.getOrThrow<string>('GITHUB_APP_PRIVATE_KEY');
    this.privateKey = rawKey.replace(/\\n/g, '\n');
    this.redis = redis;
  }

  private generateAppJwt(): string {
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign(
      { iat: now - 60, exp: now + APP_JWT_EXPIRY_SECONDS, iss: this.appId },
      this.privateKey,
      { algorithm: 'RS256' },
    );
  }

  async getInstallationToken({ installationId }: { installationId: number }): Promise<string> {
    const cacheKey = `${TOKEN_CACHE_PREFIX}${installationId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return this.encryption.decrypt({ encrypted: cached });

    const appJwt = this.generateAppJwt();
    const response = await fetch(
      `${GITHUB_API_BASE}/app/installations/${installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.warn(
        `GitHub API error for installation ${installationId}: ${String(response.status)} ${errorBody}`,
      );
      throw new Error(`Failed to get installation token: HTTP ${String(response.status)}`);
    }

    const data = (await response.json()) as {
      token: string;
      expires_at: string;
    };
    const expiresAt = new Date(data.expires_at);
    const ttlSeconds = Math.max(Math.floor((expiresAt.getTime() - Date.now()) / 1000) - 60, 60);

    await this.redis.set(
      cacheKey,
      this.encryption.encrypt({ plaintext: data.token }),
      'EX',
      ttlSeconds,
    );
    return data.token;
  }

  async getInstallationOctokit({ installationId }: { installationId: number }): Promise<Octokit> {
    const token = await this.getInstallationToken({ installationId });
    const logger = this.logger;
    return new ThrottledOctokit({
      auth: token,
      retry: { retries: 3 },
      throttle: {
        onRateLimit: (retryAfter, options, _octokit, retryCount) => {
          logger.warn(
            `GitHub rate limit hit for ${options.method} ${options.url}, retrying after ${retryAfter}s (attempt ${retryCount + 1})`,
          );
          return retryCount < 2;
        },
        onSecondaryRateLimit: (retryAfter, options, _octokit, retryCount) => {
          logger.warn(
            `GitHub secondary rate limit hit for ${options.method} ${options.url}, retrying after ${retryAfter}s`,
          );
          return retryCount < 1;
        },
      },
    });
  }

  async listRepositories({
    installationId,
  }: {
    installationId: number;
  }): Promise<GitHubRepository[]> {
    const octokit = await this.getInstallationOctokit({ installationId });
    const repos = await octokit.paginate(octokit.rest.apps.listReposAccessibleToInstallation, {
      per_page: 100,
    });
    return repos.map((r) => this.toGitHubRepository(r));
  }

  async getRepository({
    installationId,
    owner,
    repo,
  }: {
    installationId: number;
    owner: string;
    repo: string;
  }): Promise<GitHubRepository> {
    const octokit = await this.getInstallationOctokit({ installationId });
    const { data } = await octokit.rest.repos.get({ owner, repo });
    return this.toGitHubRepository(data);
  }

  private toGitHubRepository(data: {
    id: number;
    name: string;
    full_name: string;
    owner: { login: string } | null;
    default_branch: string;
    private: boolean;
    language: string | null;
    archived: boolean;
  }): GitHubRepository {
    return {
      id: data.id,
      name: data.name,
      full_name: data.full_name,
      owner: { login: data.owner?.login ?? '' },
      default_branch: data.default_branch,
      private: data.private,
      language: data.language ?? null,
      archived: data.archived,
    };
  }

  async dispatchWorkflow({
    installationId,
    owner,
    repo,
    workflowFile,
    ref,
    inputs,
  }: {
    installationId: number;
    owner: string;
    repo: string;
    workflowFile: string;
    ref: string;
    inputs?: Record<string, string>;
  }): Promise<void> {
    const octokit = await this.getInstallationOctokit({ installationId });
    await octokit.rest.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: workflowFile,
      ref,
      inputs,
    });
    this.logger.log(`Dispatched workflow ${workflowFile} on ${owner}/${repo}@${ref}`);
  }

  async getWorkflowRun({
    installationId,
    owner,
    repo,
    runId,
  }: {
    installationId: number;
    owner: string;
    repo: string;
    runId: number;
  }): Promise<WorkflowRun> {
    const octokit = await this.getInstallationOctokit({ installationId });
    const { data } = await octokit.rest.actions.getWorkflowRun({
      owner,
      repo,
      run_id: runId,
    });
    return {
      id: data.id,
      status: data.status,
      conclusion: data.conclusion,
      html_url: data.html_url,
    };
  }

  async getWorkflowRunLogs({
    installationId,
    owner,
    repo,
    runId,
  }: {
    installationId: number;
    owner: string;
    repo: string;
    runId: number;
  }): Promise<ArrayBuffer> {
    const octokit = await this.getInstallationOctokit({ installationId });
    const { data } = await octokit.rest.actions.downloadWorkflowRunLogs({
      owner,
      repo,
      run_id: runId,
    });
    return data as ArrayBuffer;
  }

  async listWorkflowRuns({
    installationId,
    owner,
    repo,
    workflowFile,
    createdAfter,
  }: {
    installationId: number;
    owner: string;
    repo: string;
    workflowFile: string;
    createdAfter: string;
  }): Promise<WorkflowRun[]> {
    const octokit = await this.getInstallationOctokit({ installationId });
    const { data } = await octokit.rest.actions.listWorkflowRuns({
      owner,
      repo,
      workflow_id: workflowFile,
      created: `>=${createdAfter}`,
      per_page: 10,
    });
    return data.workflow_runs.map((run) => ({
      id: run.id,
      status: run.status,
      conclusion: run.conclusion,
      html_url: run.html_url,
    }));
  }

  async getBranchRef({
    installationId,
    owner,
    repo,
    branch,
  }: {
    installationId: number;
    owner: string;
    repo: string;
    branch: string;
  }): Promise<GitHubRef> {
    const octokit = await this.getInstallationOctokit({ installationId });
    const { data } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
    return { ref: data.ref, sha: data.object.sha };
  }

  async createBranchRef({
    installationId,
    owner,
    repo,
    branch,
    sha,
  }: {
    installationId: number;
    owner: string;
    repo: string;
    branch: string;
    sha: string;
  }): Promise<GitHubRef> {
    const octokit = await this.getInstallationOctokit({ installationId });
    const { data } = await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha,
    });
    return { ref: data.ref, sha: data.object.sha };
  }

  async deleteBranchRef({
    installationId,
    owner,
    repo,
    branch,
  }: {
    installationId: number;
    owner: string;
    repo: string;
    branch: string;
  }): Promise<void> {
    const octokit = await this.getInstallationOctokit({ installationId });
    await octokit.rest.git.deleteRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
  }

  async createOrUpdateFileContents({
    installationId,
    owner,
    repo,
    path,
    message,
    content,
    branch,
    sha,
  }: {
    installationId: number;
    owner: string;
    repo: string;
    path: string;
    message: string;
    content: string;
    branch: string;
    sha?: string;
  }): Promise<GitHubFileCommit> {
    const octokit = await this.getInstallationOctokit({ installationId });
    const { data } = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: Buffer.from(content).toString('base64'),
      branch,
      ...(sha ? { sha } : {}),
    });
    if (!data.commit.sha || !data.commit.html_url) {
      throw new Error(`GitHub API returned incomplete commit data for ${owner}/${repo}:${path}`);
    }
    return {
      sha: data.commit.sha,
      htmlUrl: data.commit.html_url,
    };
  }

  async createPullRequest({
    installationId,
    owner,
    repo,
    title,
    body,
    head,
    base,
  }: {
    installationId: number;
    owner: string;
    repo: string;
    title: string;
    body: string;
    head: string;
    base: string;
  }): Promise<GitHubPullRequest> {
    const octokit = await this.getInstallationOctokit({ installationId });
    const { data } = await octokit.rest.pulls.create({
      owner,
      repo,
      title,
      body,
      head,
      base,
    });
    return {
      number: data.number,
      htmlUrl: data.html_url,
      title: data.title,
    };
  }

  async checkFileExists({
    installationId,
    owner,
    repo,
    path,
  }: {
    installationId: number;
    owner: string;
    repo: string;
    path: string;
  }): Promise<boolean> {
    const octokit = await this.getInstallationOctokit({ installationId });
    try {
      await octokit.rest.repos.getContent({ owner, repo, path });
      return true;
    } catch (err: unknown) {
      if (err instanceof Error && 'status' in err && (err as { status: number }).status === 404) {
        return false;
      }
      throw err;
    }
  }

  async getFileContent({
    installationId,
    owner,
    repo,
    path,
  }: {
    installationId: number;
    owner: string;
    repo: string;
    path: string;
  }): Promise<GitHubFileContent | null> {
    const octokit = await this.getInstallationOctokit({ installationId });
    try {
      const { data } = await octokit.rest.repos.getContent({ owner, repo, path });
      if (Array.isArray(data) || !('content' in data) || !('sha' in data)) {
        throw new Error(
          `Expected file content at ${owner}/${repo}:${path}, got directory or unexpected response`,
        );
      }
      return {
        content: Buffer.from(data.content, 'base64').toString('utf-8'),
        sha: data.sha,
      };
    } catch (err: unknown) {
      if (err instanceof Error && 'status' in err && (err as { status: number }).status === 404) {
        return null;
      }
      throw err;
    }
  }

  async listRepositorySecrets({
    installationId,
    owner,
    repo,
  }: {
    installationId: number;
    owner: string;
    repo: string;
  }): Promise<string[]> {
    const octokit = await this.getInstallationOctokit({ installationId });
    try {
      const { data } = await octokit.rest.actions.listRepoSecrets({
        owner,
        repo,
        per_page: 100,
      });
      return data.secrets.map((s) => s.name);
    } catch (err: unknown) {
      if (err instanceof Error && 'status' in err && (err as { status: number }).status === 403) {
        this.logger.warn(`No secrets:read permission for ${owner}/${repo}`);
        return [];
      }
      throw err;
    }
  }

  async cancelWorkflowRun({
    installationId,
    owner,
    repo,
    runId,
  }: {
    installationId: number;
    owner: string;
    repo: string;
    runId: number;
  }): Promise<void> {
    const octokit = await this.getInstallationOctokit({ installationId });
    await octokit.rest.actions.cancelWorkflowRun({
      owner,
      repo,
      run_id: runId,
    });
    this.logger.log(`Cancelled workflow run ${runId} on ${owner}/${repo}`);
  }

  async listIssueComments({
    installationId,
    owner,
    repo,
    issueNumber,
    perPage = 30,
  }: {
    installationId: number;
    owner: string;
    repo: string;
    issueNumber: number;
    perPage?: number;
  }): Promise<readonly IssueComment[]> {
    const octokit = await this.getInstallationOctokit({ installationId });
    const { data } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: perPage,
      direction: 'asc',
    });
    return data.map((c) => ({
      login: c.user?.login ?? 'unknown',
      body: (c.body ?? '').slice(0, 2000),
      createdAt: c.created_at,
    }));
  }

  async listPullRequestReviews({
    installationId,
    owner,
    repo,
    pullNumber,
    perPage = 30,
  }: {
    installationId: number;
    owner: string;
    repo: string;
    pullNumber: number;
    perPage?: number;
  }): Promise<readonly PullRequestReview[]> {
    const octokit = await this.getInstallationOctokit({ installationId });
    const { data } = await octokit.rest.pulls.listReviews({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: perPage,
    });
    return data.map((r) => ({
      login: r.user?.login ?? 'unknown',
      body: (r.body ?? '').slice(0, 2000),
      state: r.state,
      createdAt: r.submitted_at ?? 'pending',
    }));
  }
}
