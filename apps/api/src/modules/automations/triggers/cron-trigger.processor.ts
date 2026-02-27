import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CRON_TRIGGER_QUEUE } from '../automations.constants';
import { DEFAULT_WORKFLOW_FILE } from '../automations.schema';
import { AutomationRepository } from '../automations.repository';
import { ExecutionRepository } from '../../executions/executions.repository';
import { ExecutionLifecycleService } from '../../executions/execution-lifecycle.service';
import { PromptTemplateService } from '../templates/prompt-template.service';
import { JobFailureTrackerService } from '../../../common/monitoring/job-failure-tracker.service';
import { VariablesService } from '../../variables/variables.service';
import { GitHubEntityRepository } from '../../github/github-entity.repository';

export interface CronTriggerJobData {
  readonly automationId: number;
}

@Processor(CRON_TRIGGER_QUEUE)
export class CronTriggerProcessor extends WorkerHost {
  private readonly logger = new Logger(CronTriggerProcessor.name);

  constructor(
    @Inject(AutomationRepository)
    private readonly automationRepository: AutomationRepository,
    // Used directly (not via ExecutionLifecycleService) for the error path
    // where prompt resolution fails — we record a dead execution without queuing.
    @Inject(ExecutionRepository)
    private readonly executionRepository: ExecutionRepository,
    @Inject(ExecutionLifecycleService)
    private readonly executionLifecycle: ExecutionLifecycleService,
    @Inject(PromptTemplateService)
    private readonly promptTemplateService: PromptTemplateService,
    @Inject(JobFailureTrackerService)
    private readonly failureTracker: JobFailureTrackerService,
    @Inject(VariablesService)
    private readonly variablesService: VariablesService,
    @Inject(GitHubEntityRepository)
    private readonly githubEntityRepository: GitHubEntityRepository,
  ) {
    super();
  }

  async process(job: Job<CronTriggerJobData>): Promise<void> {
    const { automationId } = job.data;
    this.logger.log(`Processing cron trigger for automation ${automationId}`);

    const automation = await this.automationRepository.findByIdInternal({
      id: automationId,
    });

    if (!automation) {
      this.logger.warn(`Automation ${automationId} not found, skipping cron trigger`);
      return;
    }

    if (!automation.enabled) {
      this.logger.warn(`Automation ${automationId} is disabled, skipping cron trigger`);
      return;
    }

    const variables = automation.variables.map((v) => ({
      key: v.key,
      value: v.value,
      source: v.source,
      required: v.required,
    }));

    const cronConfig = automation.triggerConfig as {
      schedule: string;
      timezone?: string;
    };

    const repo = await this.githubEntityRepository.findRepositoryById({
      id: automation.repoId,
    });

    const builtIns: Record<string, string> = {
      'repo.owner': repo?.owner ?? '',
      'repo.name': repo?.name ?? '',
      'repo.full_name': repo?.fullName ?? '',
      timestamp: new Date().toISOString(),
      'automation.name': automation.name,
    };

    const sharedVars = await this.variablesService.findForResolution({
      orgId: automation.orgId,
      repoId: automation.repoId,
    });

    let resolvedPrompt: string;
    try {
      resolvedPrompt = this.promptTemplateService.resolve({
        template: automation.promptTemplate,
        variables,
        sharedVariables: sharedVars.map((v) => ({ key: v.key, value: v.value })),
        builtIns,
      });
    } catch (error) {
      this.failureTracker.trackFailure({ jobType: 'cron.trigger', error });
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to resolve prompt for automation ${automationId}: ${errorMessage}`);

      const failedExecution = await this.executionRepository.create({
        automationId,
        triggerEvent: { type: 'cron', schedule: cronConfig.schedule },
        resolvedPrompt: '',
        provider: automation.provider,
      });

      await this.executionRepository.updateStatus({
        id: failedExecution.id,
        status: 'failed',
        fields: { errorMessage },
      });

      return;
    }

    await this.executionLifecycle.createAndQueue({
      automationId,
      automationName: automation.name,
      repoId: automation.repoId,
      workflowFile: DEFAULT_WORKFLOW_FILE,
      triggerEvent: { type: 'cron', schedule: cronConfig.schedule },
      resolvedPrompt,
      provider: automation.provider,
      model: automation.model,
    });

    this.logger.log(
      `Created and queued execution for cron automation "${automation.name}" (${automationId})`,
    );
  }
}
