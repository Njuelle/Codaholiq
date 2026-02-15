import { Injectable, BadRequestException } from '@nestjs/common';
import { CronExpressionParser } from 'cron-parser';
import { GITHUB_EVENTS_CATALOG, buildValidEventStrings } from './github-events';
import { isSafePattern, MAX_REGEX_LENGTH } from '../templates/regex-safety.util';
import type { ConditionGroup, TriggerCondition } from './condition-evaluator.service';

const VALID_EVENT_TYPES: ReadonlySet<string> = buildValidEventStrings(GITHUB_EVENTS_CATALOG);

const MIN_CRON_INTERVAL_MS = 5 * 60 * 1000;
const VALID_PATH_REGEX = /^[a-zA-Z0-9_.]+$/;

@Injectable()
export class TriggerValidationService {
  validateEventConfig({
    config,
  }: {
    config: {
      events: string[];
      conditionGroups?: readonly ConditionGroup[];
    };
  }): void {
    const unknownEvents = config.events.filter((event) => !VALID_EVENT_TYPES.has(event));
    if (unknownEvents.length > 0) {
      throw new BadRequestException(
        `Unknown event types: ${unknownEvents.join(', ')}. Supported events: ${[...VALID_EVENT_TYPES].join(', ')}`,
      );
    }

    if (config.conditionGroups) {
      this.validateConditionGroups({
        conditionGroups: config.conditionGroups,
      });
    }
  }

  private validateConditionGroups({
    conditionGroups,
  }: {
    conditionGroups: readonly ConditionGroup[];
  }): void {
    for (const group of conditionGroups) {
      for (const condition of group.conditions) {
        this.validateCondition({ condition });
      }
    }
  }

  private validateCondition({ condition }: { condition: TriggerCondition }): void {
    if (!VALID_PATH_REGEX.test(condition.path)) {
      throw new BadRequestException(
        `Invalid condition path: "${condition.path}". Paths may only contain letters, numbers, dots, and underscores.`,
      );
    }

    if (condition.operator === 'matches' && condition.value) {
      if (condition.value.length > MAX_REGEX_LENGTH) {
        throw new BadRequestException(
          `Regex pattern must not exceed ${MAX_REGEX_LENGTH} characters`,
        );
      }
      if (!isSafePattern(condition.value)) {
        throw new BadRequestException(
          'Regex pattern rejected: nested quantifiers can cause catastrophic backtracking',
        );
      }
      try {
        new RegExp(condition.value);
      } catch {
        throw new BadRequestException(`Invalid regex pattern: "${condition.value}"`);
      }
    }
  }

  validateCronConfig({ config }: { config: { schedule: string; timezone?: string } }): void {
    if (config.timezone) {
      const supportedTimezones = Intl.supportedValuesOf('timeZone');
      if (!supportedTimezones.includes(config.timezone)) {
        throw new BadRequestException(`Invalid timezone: ${config.timezone}`);
      }
    }

    let interval;
    try {
      interval = CronExpressionParser.parse(config.schedule, {
        tz: config.timezone,
      });
    } catch {
      throw new BadRequestException(`Invalid cron expression: ${config.schedule}`);
    }

    const first = interval.next().toDate();
    const second = interval.next().toDate();
    const intervalMs = second.getTime() - first.getTime();

    if (intervalMs < MIN_CRON_INTERVAL_MS) {
      throw new BadRequestException('Cron schedule interval must be at least 5 minutes');
    }
  }

  validateManualConfig({ config }: { config: Record<string, unknown> }): void {
    if (Object.keys(config).length > 0) {
      throw new BadRequestException('Manual trigger config must be an empty object');
    }
  }
}
