import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InstallationService } from '../github/installation.service';
import { EventMatcherService } from '../automations/triggers/event-matcher.service';
import { WorkflowRunService } from '../executions/workflow-run.service';
import { JobFailureTrackerService } from '../../common/monitoring/job-failure-tracker.service';
import { WEBHOOK_QUEUE } from './webhooks.constants';
import { DEFAULT_WORKFLOW_FILE } from '../automations/automations.schema';

const CODAHOLIQ_WORKFLOW_SUFFIX = DEFAULT_WORKFLOW_FILE.split('/').pop();

export interface WebhookJobData {
  readonly event: string;
  readonly action: string;
  readonly deliveryId: string;
  readonly payload: Record<string, unknown>;
}

@Processor(WEBHOOK_QUEUE, { concurrency: 10 })
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(
    @Inject(InstallationService)
    private readonly installationService: InstallationService,
    @Inject(EventMatcherService)
    private readonly eventMatcherService: EventMatcherService,
    @Inject(WorkflowRunService)
    private readonly workflowRunService: WorkflowRunService,
    @Inject(JobFailureTrackerService)
    private readonly failureTracker: JobFailureTrackerService,
  ) {
    super();
  }

  async process(job: Job<WebhookJobData>): Promise<void> {
    const { event, action, deliveryId, payload } = job.data;
    this.logger.log(`Processing webhook: ${job.name} (delivery: ${deliveryId})`);

    try {
      switch (event) {
        case 'installation':
          await this.handleInstallationEvent({ action, payload });
          break;
        case 'installation_repositories':
          await this.handleInstallationRepositoriesEvent({ action, payload });
          break;
        case 'workflow_run':
          // Handle execution tracking first, then also route to automation matching
          if (action === 'completed') {
            await this.workflowRunService.handleWorkflowRunCompleted({
              payload,
            });
          }
          await this.handleAutomationEvent({ event, action, payload });
          break;
        default:
          await this.handleAutomationEvent({ event, action, payload });
      }
    } catch (error) {
      this.failureTracker.trackFailure({ jobType: `webhook.${event}`, error });
      this.logger.error(
        `Failed to process webhook ${event}.${action} (delivery: ${deliveryId}): ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  private async handleInstallationEvent({
    action,
    payload,
  }: {
    action: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    switch (action) {
      case 'created':
        await this.installationService.handleInstallationCreated({ payload });
        break;
      case 'deleted':
        await this.installationService.handleInstallationDeleted({ payload });
        break;
      case 'suspend':
        await this.installationService.handleInstallationSuspended({ payload });
        break;
      case 'unsuspend':
        await this.installationService.handleInstallationUnsuspended({
          payload,
        });
        break;
      default:
        this.logger.warn(`Unhandled installation action: ${action}`);
    }
  }

  private async handleInstallationRepositoriesEvent({
    action,
    payload,
  }: {
    action: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    switch (action) {
      case 'added':
        await this.installationService.handleRepositoriesAdded({ payload });
        break;
      case 'removed':
        await this.installationService.handleRepositoriesRemoved({ payload });
        break;
      default:
        this.logger.warn(`Unhandled installation_repositories action: ${action}`);
    }
  }

  private async handleAutomationEvent({
    event,
    action,
    payload,
  }: {
    event: string;
    action: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const repoFullName = (payload.repository as { full_name?: string } | undefined)?.full_name;

    if (!repoFullName) {
      this.logger.warn(
        `Webhook event ${event}.${action} has no repository, skipping automation matching`,
      );
      return;
    }

    // Prevent self-triggering loops: skip events caused by Codaholiq workflows
    if (this.isCodaholiqWorkflowEvent({ event, payload })) {
      this.logger.log(
        `Skipping automation matching for Codaholiq-triggered event ${event}.${action}`,
      );
      return;
    }

    await this.eventMatcherService.findAndCreateExecutions({
      repoFullName,
      eventType: event,
      action,
      payload,
    });
  }

  private isCodaholiqWorkflowEvent({
    event,
    payload,
  }: {
    event: string;
    payload: Record<string, unknown>;
  }): boolean {
    // Check if a workflow_run event was triggered by the Codaholiq workflow file
    if (event === 'workflow_run') {
      const workflowRun = payload.workflow_run as { path?: string } | undefined;
      const workflowPath = workflowRun?.path ?? '';
      if (CODAHOLIQ_WORKFLOW_SUFFIX && workflowPath.endsWith(CODAHOLIQ_WORKFLOW_SUFFIX)) {
        return true;
      }
    }

    return false;
  }
}
