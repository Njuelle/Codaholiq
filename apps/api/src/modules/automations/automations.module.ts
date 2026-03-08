import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GitHubModule } from '../github/github.module';
import { ExecutionsModule } from '../executions/executions.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { VariablesModule } from '../variables/variables.module';
import { ModelPoliciesModule } from '../model-policies/model-policies.module';
import { AutomationsController } from './automations.controller';
import { GitHubEventsController } from './triggers/github-events.controller';
import { ModelsController } from './models.controller';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogService } from './catalog/catalog.service';
import { AutomationRepository } from './automations.repository';
import { AutomationService } from './automations.service';
import { TriggerValidationService } from './triggers/trigger-validation.service';
import { EventMatcherService } from './triggers/event-matcher.service';
import { PromptTemplateService } from './templates/prompt-template.service';
import { ConditionEvaluatorService } from './triggers/condition-evaluator.service';
import { CronSchedulerService } from './triggers/cron-scheduler.service';
import { CronTriggerProcessor } from './triggers/cron-trigger.processor';
import { CRON_TRIGGER_QUEUE } from './automations.constants';
import { JobFailureTrackerService } from '../../common/monitoring/job-failure-tracker.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: CRON_TRIGGER_QUEUE }),
    forwardRef(() => GitHubModule),
    forwardRef(() => ExecutionsModule),
    forwardRef(() => OrganizationsModule),
    VariablesModule,
    ModelPoliciesModule,
  ],
  controllers: [AutomationsController, GitHubEventsController, ModelsController, CatalogController],
  providers: [
    AutomationRepository,
    AutomationService,
    TriggerValidationService,
    EventMatcherService,
    PromptTemplateService,
    ConditionEvaluatorService,
    CronSchedulerService,
    CronTriggerProcessor,
    JobFailureTrackerService,
    CatalogService,
  ],
  exports: [AutomationRepository, AutomationService, EventMatcherService, PromptTemplateService],
})
export class AutomationsModule {}
