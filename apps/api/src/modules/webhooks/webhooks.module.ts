import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GitHubModule } from '../github/github.module';
import { AutomationsModule } from '../automations/automations.module';
import { ExecutionsModule } from '../executions/executions.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksGuard } from './webhooks.guard';
import { WebhookProcessor } from './webhook.processor';
import { WEBHOOK_QUEUE } from './webhooks.constants';
import { JobFailureTrackerService } from '../../common/monitoring/job-failure-tracker.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: WEBHOOK_QUEUE }),
    GitHubModule,
    AutomationsModule,
    ExecutionsModule,
  ],
  controllers: [WebhooksController],
  providers: [WebhooksGuard, WebhookProcessor, JobFailureTrackerService],
})
export class WebhooksModule {}
