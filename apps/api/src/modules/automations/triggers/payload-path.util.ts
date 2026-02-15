/**
 * Segments that must never be traversed to prevent prototype pollution
 * or unintended access to built-in object properties.
 */
const FORBIDDEN_SEGMENTS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Resolve a dot-notation path from a nested object.
 * Returns `undefined` if any segment is missing or forbidden.
 *
 * @example
 * resolvePayloadPath({ path: 'pull_request.base.ref', payload: { pull_request: { base: { ref: 'main' } } } })
 * // => 'main'
 */
export function resolvePayloadPath({
  path,
  payload,
}: {
  path: string;
  payload: Record<string, unknown>;
}): unknown {
  const segments = path.split('.');
  let current: unknown = payload;

  for (const segment of segments) {
    if (FORBIDDEN_SEGMENTS.has(segment)) return undefined;
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }

  return current ?? undefined;
}

/**
 * Resolve a payload path and coerce the result to a string.
 * Objects are JSON-stringified, primitives are converted via String().
 * Returns `undefined` if the path does not resolve.
 */
export function resolvePayloadPathAsString({
  path,
  payload,
}: {
  path: string;
  payload: Record<string, unknown>;
}): string | undefined {
  const value = resolvePayloadPath({ path, payload });

  if (value === null || value === undefined) return undefined;
  if (typeof value === 'object') return JSON.stringify(value);
  return typeof value === 'string' ? value : String(value as number | boolean);
}
