import { Injectable, Inject, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const CHANNEL_PREFIX = 'exec:logs:';

interface LogMessage {
  readonly type: 'log' | 'status';
  readonly data: string;
}

@Injectable()
export class RedisLogPublisherService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisLogPublisherService.name);
  private readonly publisher: Redis;
  private readonly subscriber: Redis;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    const redisUrl = this.configService.getOrThrow<string>('REDIS_URL');
    this.publisher = new Redis(redisUrl, { maxRetriesPerRequest: 3 });
    this.subscriber = new Redis(redisUrl, { maxRetriesPerRequest: 3 });
  }

  async publishLog({ executionId, log }: { executionId: number; log: unknown }): Promise<void> {
    const message: LogMessage = {
      type: 'log',
      data: JSON.stringify(log),
    };
    await this.publisher.publish(`${CHANNEL_PREFIX}${executionId}`, JSON.stringify(message));
  }

  async publishStatus({
    executionId,
    status,
  }: {
    executionId: number;
    status: string;
  }): Promise<void> {
    const message: LogMessage = {
      type: 'status',
      data: JSON.stringify({ status }),
    };
    await this.publisher.publish(`${CHANNEL_PREFIX}${executionId}`, JSON.stringify(message));
  }

  subscribe({
    executionId,
    onMessage,
  }: {
    executionId: number;
    onMessage: (message: LogMessage) => void;
  }): () => void {
    const channel = `${CHANNEL_PREFIX}${executionId}`;

    const handler = (ch: string, raw: string): void => {
      if (ch !== channel) return;
      try {
        onMessage(JSON.parse(raw) as LogMessage);
      } catch (error) {
        this.logger.warn(
          `Failed to parse Redis message on ${channel}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };

    this.subscriber.on('message', handler);
    void this.subscriber.subscribe(channel).catch((error) => {
      this.logger.error(
        `Failed to subscribe to ${channel}: ${error instanceof Error ? error.message : String(error)}`,
      );
    });

    return () => {
      this.subscriber.off('message', handler);
      void this.subscriber.unsubscribe(channel).catch((error) => {
        this.logger.warn(
          `Failed to unsubscribe from ${channel}: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    };
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.publisher.quit(), this.subscriber.quit()]);
  }
}
