import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { HealthService, type HealthCheckResult } from './health.service';

interface ReadinessCheckStatus {
  readonly status: 'up' | 'down';
}

interface ReadinessResponse {
  readonly status: 'ready' | 'degraded';
  readonly checks: {
    readonly database: ReadinessCheckStatus;
    readonly redis: ReadinessCheckStatus;
    readonly github: ReadinessCheckStatus;
  };
}

@Controller('health')
@Public()
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  check(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(): Promise<ReadinessResponse> {
    const [dbResult, redisResult, githubResult] = await Promise.allSettled([
      this.healthService.checkDatabase(),
      this.healthService.checkRedis(),
      this.healthService.checkGitHub(),
    ]);

    const toStatus = (result: PromiseSettledResult<HealthCheckResult>): ReadinessCheckStatus =>
      result.status === 'fulfilled' && result.value.status === 'up'
        ? { status: 'up' }
        : { status: 'down' };

    const checks = {
      database: toStatus(dbResult),
      redis: toStatus(redisResult),
      github: toStatus(githubResult),
    };

    const isHealthy = checks.database.status === 'up' && checks.redis.status === 'up';

    if (!isHealthy) {
      throw new ServiceUnavailableException({
        message: 'Service not ready',
        details: { status: 'degraded', checks },
      });
    }

    return { status: 'ready', checks };
  }
}
