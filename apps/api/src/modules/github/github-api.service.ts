import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Octokit } from '@octokit/rest';
import * as jwt from 'jsonwebtoken';
import type Redis from 'ioredis';
import { REDIS } from '../redis/redis.constants';

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

@Injectable()
export class GitHubApiService {
  private readonly logger = new Logger(GitHubApiService.name);
  private readonly redis: Redis;
  private readonly appId: string;
  private readonly privateKey: string;

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(REDIS) redis: Redis,
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
    if (cached) return cached;

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
      throw new Error(`Failed to get installation token: ${response.status} ${errorBody}`);
    }

    const data = (await response.json()) as {
      token: string;
      expires_at: string;
    };
    const expiresAt = new Date(data.expires_at);
    const ttlSeconds = Math.max(Math.floor((expiresAt.getTime() - Date.now()) / 1000) - 60, 60);

    await this.redis.set(cacheKey, data.token, 'EX', ttlSeconds);
    return data.token;
  }

  async getInstallationOctokit({ installationId }: { installationId: number }): Promise<Octokit> {
    const token = await this.getInstallationToken({ installationId });
    return new Octokit({ auth: token });
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
