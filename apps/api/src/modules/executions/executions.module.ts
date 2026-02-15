import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GitHubModule } from '../github/github.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ExecutionRepository } from './executions.repository';
import { ExecutionLifecycleService } from './execution-lifecycle.service';
import { ExecutionsService } from './executions.service';
import { ExecutionProcessor } from './execution.processor';
import { WorkflowRunService } from './workflow-run.service';
import { RedisLogPublisherService } from './redis-log-publisher.service';
import { ExecutionsController } from './executions.controller';
import { WorkflowTemplateController } from './workflow-template.controller';
import { EXECUTION_QUEUE } from './executions.constants';
import { JobFailureTrackerService } from '../../common/monitoring/job-failure-tracker.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: EXECUTION_QUEUE }),
    forwardRef(() => GitHubModule),
    forwardRef(() => OrganizationsModule),
    NotificationsModule,
  ],
  controllers: [ExecutionsController, WorkflowTemplateController],
  providers: [
    ExecutionRepository,
    ExecutionLifecycleService,
    ExecutionsService,
    ExecutionProcessor,
    WorkflowRunService,
    RedisLogPublisherService,
    JobFailureTrackerService,
  ],
  exports: [ExecutionRepository, ExecutionLifecycleService, ExecutionsService, WorkflowRunService],
})
export class ExecutionsModule {}
