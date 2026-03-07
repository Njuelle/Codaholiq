import { Injectable, Inject, Logger } from '@nestjs/common';
import { AutomationRepository } from '../automations.repository';
import { GitHubEntityRepository } from '../../github/github-entity.repository';
import { ExecutionLifecycleService } from '../../executions/execution-lifecycle.service';
import { PromptTemplateService } from '../templates/prompt-template.service';
import { ConditionEvaluatorService } from './condition-evaluator.service';
import { VariablesService } from '../../variables/variables.service';
import type { ConditionGroup } from './condition-evaluator.service';
import type { AutomationWithVariables } from '../automations.types';
import { automations, DEFAULT_WORKFLOW_FILE } from '../automations.schema';

@Injectable()
export class EventMatcherService {
  private readonly logger = new Logger(EventMatcherService.name);

  constructor(
    @Inject(AutomationRepository)
    private readonly automationRepository: AutomationRepository,
    @Inject(GitHubEntityRepository)
    private readonly githubEntityRepository: GitHubEntityRepository,
    @Inject(ExecutionLifecycleService)
    private readonly executionLifecycle: ExecutionLifecycleService,
    @Inject(PromptTemplateService)
    private readonly promptTemplateService: PromptTemplateService,
    @Inject(ConditionEvaluatorService)
    private readonly conditionEvaluator: ConditionEvaluatorService,
    @Inject(VariablesService)
    private readonly variablesService: VariablesService,
  ) {}

  async findMatchingAutomations({
    repoFullName,
    eventType,
    action,
    payload,
  }: {
    repoFullName: string;
    eventType: string;
    action: string;
    payload: Record<string, unknown>;
  }): Promise<(typeof automations.$inferSelect)[]> {
    const repo = await this.githubEntityRepository.findRepositoryByFullNameGlobal({
      fullName: repoFullName,
    });

    if (!repo) {
      this.logger.warn(`Repository not found for event matching: ${repoFullName}`);
      return [];
    }

    // Build the compound event string: eventType.action (e.g., "pull_request.opened")
    const compoundEvent = action ? `${eventType}.${action}` : eventType;

    // Query automations that match the base compound event
    const candidates = await this.automationRepository.findByRepoAndEvent({
      repoId: repo.id,
      eventType: compoundEvent,
    });

    // Also check for more specific compound events
    // e.g., an automation subscribed to "workflow_run.completed.failure"
    // should only match when conclusion === 'failure'
    if (candidates.length === 0) {
      const compoundMatches = await this.findCompoundEventMatches({
        repoId: repo.id,
        eventType,
        action,
        payload,
      });
      return this.filterByConditions({ candidates: compoundMatches, payload });
    }

    return this.filterByConditions({ candidates, payload });
  }

  private filterByConditions({
    candidates,
    payload,
  }: {
    candidates: (typeof automations.$inferSelect)[];
    payload: Record<string, unknown>;
  }): (typeof automations.$inferSelect)[] {
    return candidates.filter((automation) => {
      const conditionGroups = this.extractConditionGroups(automation.triggerConfig);
      const passes = this.conditionEvaluator.evaluateGroups({
        conditionGroups,
        payload,
      });
      if (!passes) {
        this.logger.log(
          `Skipped automation "${automation.name}" (${automation.id}): conditions not satisfied`,
        );
      }
      return passes;
    });
  }

  /**
   * Safely extract conditionGroups from a jsonb triggerConfig column,
   * returning undefined (match-all) if the structure is unexpected.
   */
  private extractConditionGroups(triggerConfig: unknown): ConditionGroup[] | undefined {
    if (!triggerConfig || typeof triggerConfig !== 'object') return undefined;
    const config = triggerConfig as Record<string, unknown>;
    const groups = config.conditionGroups;
    if (!Array.isArray(groups)) return undefined;

    const valid = groups.every(
      (g): g is ConditionGroup =>
        g !== null &&
        typeof g === 'object' &&
        'conditions' in g &&
        Array.isArray((g as Record<string, unknown>).conditions),
    );
    return valid ? groups : undefined;
  }

  async findAndCreateExecutions({
    repoFullName,
    eventType,
    action,
    payload,
  }: {
    repoFullName: string;
    eventType: string;
    action: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const matchingAutomations = await this.findMatchingAutomations({
      repoFullName,
      eventType,
      action,
      payload,
    });

    if (matchingAutomations.length === 0) {
      return;
    }

    this.logger.log(
      `Found ${matchingAutomations.length} matching automation(s) for ${eventType}.${action} on ${repoFullName}`,
    );

    for (const automation of matchingAutomations) {
      try {
        await this.createExecutionForAutomation({
          automation: automation as AutomationWithVariables,
          eventType,
          action,
          payload,
        });
      } catch (error) {
        this.logger.error(
          `Failed to create execution for automation ${automation.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  private async createExecutionForAutomation({
    automation,
    eventType,
    action,
    payload,
  }: {
    automation: AutomationWithVariables;
    eventType: string;
    action: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    // Load full automation with variables if not already loaded
    const fullAutomation = automation.variables
      ? automation
      : await this.automationRepository.findByIdInternal({ id: automation.id });
    if (!fullAutomation) return;

    const variables = fullAutomation.variables.map((v) => ({
      key: v.key,
      value: v.value,
      source: v.source,
      required: v.required,
    }));

    const eventBuiltIns = this.extractEventBuiltIns({ eventType, payload });

    const builtIns: Record<string, string> = {
      'event.type': eventType,
      'event.action': action,
      timestamp: new Date().toISOString(),
      'automation.name': automation.name,
      ...eventBuiltIns,
    };

    const sharedVars = await this.variablesService.findForResolution({
      orgId: automation.orgId,
      repoId: automation.repoId,
    });

    const resolvedPrompt = this.promptTemplateService.resolve({
      template: automation.promptTemplate,
      variables,
      sharedVariables: sharedVars.map((v) => ({ key: v.key, value: v.value })),
      eventPayload: payload,
      builtIns,
    });

    await this.executionLifecycle.createAndQueue({
      automationId: automation.id,
      automationName: automation.name,
      repoId: automation.repoId,
      workflowFile: DEFAULT_WORKFLOW_FILE,
      triggerEvent: {
        type: eventType,
        action,
        payload: this.sanitizePayload(payload),
      },
      resolvedPrompt,
      provider: automation.provider,
      model: automation.model,
    });

    this.logger.log(
      `Created and queued execution for automation "${automation.name}" (${automation.id})`,
    );
  }

  private extractEventBuiltIns({
    eventType,
    payload,
  }: {
    eventType: string;
    payload: Record<string, unknown>;
  }): Record<string, string> {
    const builtIns: Record<string, string> = {
      'event.title': '',
      'event.body': '',
      'event.number': '',
      'event.label': '',
      'event.repo': '',
      'event.comment.body': '',
      'event.comment.author': '',
    };

    // Repository info
    const repository = payload.repository as { full_name?: string } | undefined;
    if (repository?.full_name) {
      builtIns['event.repo'] = repository.full_name;
    }

    // Label context
    const label = payload.label as { name?: string } | undefined;
    if (label?.name) {
      builtIns['event.label'] = label.name;
    }

    // Pull request context
    if (
      eventType === 'pull_request' ||
      eventType === 'pull_request_review' ||
      eventType === 'pull_request_review_comment' ||
      eventType === 'pull_request_review_thread'
    ) {
      const pr = payload.pull_request as
        | { number?: number; title?: string; body?: string }
        | undefined;
      if (pr?.number) builtIns['event.number'] = String(pr.number);
      if (pr?.title) builtIns['event.title'] = pr.title;
      if (pr?.body) builtIns['event.body'] = pr.body;
    }

    // Issue comment context (handles both issues and PRs)
    if (eventType === 'issue_comment') {
      const issue = payload.issue as
        | { number?: number; title?: string; body?: string; pull_request?: unknown }
        | undefined;
      if (issue?.number) {
        builtIns['event.number'] = String(issue.number);
        if (issue.title) builtIns['event.title'] = issue.title;
        if (!issue.pull_request && issue.body) {
          builtIns['event.body'] = issue.body;
        }
      }
    }

    // Issue context
    if (eventType === 'issues') {
      const issue = payload.issue as { number?: number; title?: string; body?: string } | undefined;
      if (issue?.number) builtIns['event.number'] = String(issue.number);
      if (issue?.title) builtIns['event.title'] = issue.title;
      if (issue?.body) builtIns['event.body'] = issue.body;
    }

    // Discussion comment context
    if (eventType === 'discussion_comment') {
      const discussion = payload.discussion as
        | { number?: number; title?: string; body?: string }
        | undefined;
      if (discussion?.number) builtIns['event.number'] = String(discussion.number);
      if (discussion?.title) builtIns['event.title'] = discussion.title;
      if (discussion?.body) builtIns['event.body'] = discussion.body;
    }

    // Comment context (all comment event types)
    if (
      eventType === 'issue_comment' ||
      eventType === 'pull_request_review_comment' ||
      eventType === 'discussion_comment' ||
      eventType === 'commit_comment'
    ) {
      const comment = payload.comment as { body?: string; user?: { login?: string } } | undefined;
      if (comment?.body) builtIns['event.comment.body'] = comment.body.slice(0, 10_000);
      if (comment?.user?.login) builtIns['event.comment.author'] = comment.user.login;
    }

    return builtIns;
  }

  private async findCompoundEventMatches({
    repoId,
    eventType,
    action,
    payload,
  }: {
    repoId: number;
    eventType: string;
    action: string;
    payload: Record<string, unknown>;
  }): Promise<(typeof automations.$inferSelect)[]> {
    // For compound events like workflow_run.completed, check for
    // conclusion-specific variants like workflow_run.completed.failure.
    // The base compound (eventType.action) was already queried by the caller.
    if (!action) return [];

    const conclusion = this.extractConclusion({ eventType, payload });
    if (!conclusion) return [];

    const compoundWithConclusion = `${eventType}.${action}.${conclusion}`;
    return this.automationRepository.findByRepoAndEvent({
      repoId,
      eventType: compoundWithConclusion,
    });
  }

  private extractConclusion({
    eventType,
    payload,
  }: {
    eventType: string;
    payload: Record<string, unknown>;
  }): string | undefined {
    const conclusionKeys: Record<string, string> = {
      workflow_run: 'workflow_run',
      workflow_job: 'workflow_job',
      check_run: 'check_run',
      check_suite: 'check_suite',
    };

    const payloadKey = conclusionKeys[eventType];
    if (!payloadKey) return undefined;

    const obj = payload[payloadKey] as { conclusion?: string } | undefined;
    return obj?.conclusion ?? undefined;
  }

  /**
   * Strip PII fields (emails, avatars) from GitHub webhook payloads before
   * persisting to the executions table for audit/debugging.
   */
  private sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
    const SENSITIVE_KEYS = new Set(['email', 'gravatar_id', 'avatar_url', 'received_events_url']);

    const sanitize = (value: unknown): unknown => {
      if (value === null || value === undefined) return value;
      if (Array.isArray(value)) return value.map(sanitize);
      if (typeof value === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
          if (SENSITIVE_KEYS.has(key)) continue;
          result[key] = sanitize(val);
        }
        return result;
      }
      return value;
    };

    return sanitize(payload) as Record<string, unknown>;
  }
}
