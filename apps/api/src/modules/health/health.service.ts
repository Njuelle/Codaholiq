import { Injectable, Inject, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import type Redis from 'ioredis';
import { DRIZZLE } from '../../database/database.module';
import { REDIS } from '../redis/redis.constants';
import type * as schema from '../../database/schema';

export interface HealthCheckResult {
  readonly status: 'up' | 'down';
  readonly latencyMs: number;
  readonly error?: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async checkDatabase(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      await this.db.execute(sql`SELECT 1`);
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Database health check failed: ${message}`);
      return { status: 'down', latencyMs: Date.now() - start, error: 'Service unavailable' };
    }
  }

  async checkRedis(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      await this.redis.ping();
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Redis health check failed: ${message}`);
      return { status: 'down', latencyMs: Date.now() - start, error: 'Service unavailable' };
    }
  }

  async checkGitHub(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch('https://api.github.com', {
        method: 'HEAD',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (response.ok) {
        return { status: 'up', latencyMs: Date.now() - start };
      }
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        error: `HTTP ${String(response.status)}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`GitHub health check failed: ${message}`);
      return { status: 'down', latencyMs: Date.now() - start, error: 'Service unavailable' };
    }
  }
}
