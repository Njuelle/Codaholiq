import type { ConditionOperator } from '@/common/types';

export const OPERATOR_LABELS: Readonly<Record<ConditionOperator, string>> = {
  equals: 'equals',
  not_equals: 'does not equal',
  contains: 'contains',
  not_contains: 'does not contain',
  starts_with: 'starts with',
  ends_with: 'ends with',
  matches: 'matches regex',
  exists: 'exists',
  not_exists: 'does not exist',
};

export const ALL_OPERATORS: readonly ConditionOperator[] = [
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'matches',
  'exists',
  'not_exists',
];

export const VALUE_LESS_OPERATORS = new Set<ConditionOperator>(['exists', 'not_exists']);
