import { Injectable, Logger } from '@nestjs/common';
import { resolvePayloadPath } from './payload-path.util';
import { isSafePattern, MAX_REGEX_LENGTH } from '../templates/regex-safety.util';

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'matches'
  | 'exists'
  | 'not_exists';

export interface TriggerCondition {
  readonly path: string;
  readonly operator: ConditionOperator;
  readonly value?: string;
}

export interface ConditionGroup {
  readonly conditions: readonly TriggerCondition[];
}

const MAX_COERCED_STRING_LENGTH = 10_000;

@Injectable()
export class ConditionEvaluatorService {
  private readonly logger = new Logger(ConditionEvaluatorService.name);

  /**
   * Evaluate condition groups against a payload (OR between groups, AND within each).
   * Returns true if conditionGroups is undefined, empty, or any group passes.
   */
  evaluateGroups({
    conditionGroups,
    payload,
  }: {
    conditionGroups: readonly ConditionGroup[] | undefined;
    payload: Record<string, unknown>;
  }): boolean {
    if (!conditionGroups || conditionGroups.length === 0) return true;

    return conditionGroups.some((group) => this.evaluateGroup({ group, payload }));
  }

  private evaluateGroup({
    group,
    payload,
  }: {
    group: ConditionGroup;
    payload: Record<string, unknown>;
  }): boolean {
    if (group.conditions.length === 0) return true;

    return group.conditions.every((condition) => this.evaluateCondition({ condition, payload }));
  }

  private evaluateCondition({
    condition,
    payload,
  }: {
    condition: TriggerCondition;
    payload: Record<string, unknown>;
  }): boolean {
    const resolved = resolvePayloadPath({ path: condition.path, payload });

    switch (condition.operator) {
      case 'exists':
        return resolved !== undefined;
      case 'not_exists':
        return resolved === undefined;
      default:
        return this.evaluateValueOperator({
          operator: condition.operator,
          resolved,
          expected: condition.value ?? '',
        });
    }
  }

  private evaluateValueOperator({
    operator,
    resolved,
    expected,
  }: {
    operator: Exclude<ConditionOperator, 'exists' | 'not_exists'>;
    resolved: unknown;
    expected: string;
  }): boolean {
    // Special array handling for contains/not_contains
    if (Array.isArray(resolved) && (operator === 'contains' || operator === 'not_contains')) {
      return this.evaluateArrayOperator({ operator, array: resolved, expected });
    }

    const stringValue = this.coerceToString(resolved);
    if (stringValue === undefined) return false;

    switch (operator) {
      case 'equals':
        return stringValue === expected;
      case 'not_equals':
        return stringValue !== expected;
      case 'contains':
        return stringValue.includes(expected);
      case 'not_contains':
        return !stringValue.includes(expected);
      case 'starts_with':
        return stringValue.startsWith(expected);
      case 'ends_with':
        return stringValue.endsWith(expected);
      case 'matches':
        return this.safeRegexMatch({ pattern: expected, value: stringValue });
    }
  }

  /**
   * For arrays of objects, check if any element's `.name` property matches.
   * This is GitHub-specific: label objects, milestone objects, etc. use `.name`.
   * For arrays of primitives, check direct string-coerced membership.
   */
  private evaluateArrayOperator({
    operator,
    array,
    expected,
  }: {
    operator: 'contains' | 'not_contains';
    array: readonly unknown[];
    expected: string;
  }): boolean {
    const hasMatch = array.some((item) => {
      if (item !== null && typeof item === 'object') {
        const name = (item as Record<string, unknown>).name;
        return typeof name === 'string' && name === expected;
      }
      return String(item) === expected;
    });

    return operator === 'contains' ? hasMatch : !hasMatch;
  }

  private coerceToString(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string') return value;
    if (typeof value === 'boolean' || typeof value === 'number') {
      return String(value);
    }
    if (typeof value === 'object') {
      const json = JSON.stringify(value);
      if (json.length > MAX_COERCED_STRING_LENGTH) {
        this.logger.warn(
          `Coerced object exceeds max length (${MAX_COERCED_STRING_LENGTH}), skipping`,
        );
        return undefined;
      }
      return json;
    }
    return undefined;
  }

  private safeRegexMatch({ pattern, value }: { pattern: string; value: string }): boolean {
    if (pattern.length > MAX_REGEX_LENGTH) {
      this.logger.warn(`Regex pattern exceeds max length (${MAX_REGEX_LENGTH}): truncated`);
      return false;
    }

    if (!isSafePattern(pattern)) {
      this.logger.warn(`Regex pattern rejected (potential ReDoS): ${pattern}`);
      return false;
    }

    try {
      const regex = new RegExp(pattern);
      return regex.test(value);
    } catch {
      this.logger.warn(`Invalid regex pattern: ${pattern}`);
      return false;
    }
  }
}
