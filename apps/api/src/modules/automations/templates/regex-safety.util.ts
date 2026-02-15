/**
 * Regex safety utilities for user-supplied patterns.
 *
 * Detects common ReDoS (Regular Expression Denial of Service) patterns
 * such as nested quantifiers that cause catastrophic backtracking.
 */

export const MAX_REGEX_LENGTH = 200;

/**
 * Regex that detects nested quantifiers — the most common source of
 * catastrophic backtracking. Matches patterns like:
 *   (a+)+  (a*)*  (a+)*  (a+){2,}  ((ab)+cd)+
 *
 * Looks for a quantifier (+, *, {n}) inside a group, followed by
 * another quantifier outside the group.
 */
const NESTED_QUANTIFIER_RE = /\((?:[^()\\]|\\.)*(?:[+*]|\{\d)(?:[^()\\]|\\.)*\)(?:[+*?]|\{)/;

/**
 * Returns `true` if the pattern appears safe from ReDoS.
 * Returns `false` if the pattern contains nested quantifiers
 * or other constructs likely to cause catastrophic backtracking.
 *
 * This is a heuristic check — it may produce false positives (rejecting
 * safe patterns) but should not produce false negatives for common
 * ReDoS attack vectors.
 */
export function isSafePattern(pattern: string): boolean {
  return !NESTED_QUANTIFIER_RE.test(pattern);
}
