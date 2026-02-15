import {
  Controller,
  Post,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
  Inject,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import type Redis from 'ioredis';
import { Public } from '../../common/decorators/public.decorator';
import { WebhooksGuard } from './webhooks.guard';
import { WEBHOOK_QUEUE } from './webhooks.constants';
import { REDIS } from '../redis/redis.constants';

const DELIVERY_ID_TTL_SECONDS = 86400; // 24 hours
const DELIVERY_ID_PREFIX = 'webhook:delivery:';

@Controller('webhooks')
@Public()
@Throttle({ default: { limit: 1000, ttl: 60000 } })
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    @InjectQueue(WEBHOOK_QUEUE) private readonly webhookQueue: Queue,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Post('github')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WebhooksGuard)
  async handleGitHubWebhook(@Req() request: Request): Promise<{ received: true }> {
    const event = request.headers['x-github-event'] as string;
    const deliveryId = request.headers['x-github-delivery'] as string;
    const payload = request.body as Record<string, unknown>;
    const action = (payload.action as string | undefined) ?? '';

    // Deduplicate by delivery ID to prevent replay attacks
    if (deliveryId) {
      const key = `${DELIVERY_ID_PREFIX}${deliveryId}`;
      const wasSet = await this.redis.set(key, '1', 'EX', DELIVERY_ID_TTL_SECONDS, 'NX');
      if (!wasSet) {
        this.logger.warn(`Duplicate webhook delivery rejected: ${deliveryId}`);
        return { received: true };
      }
    }

    const jobName = action ? `${event}.${action}` : event;

    this.logger.log(`Received webhook: ${jobName} (delivery: ${deliveryId})`);

    await this.webhookQueue.add(
      jobName,
      { event, action, deliveryId, payload },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    );

    return { received: true };
  }
}
