/**
 * Builds a query parameter object from an optional filters object.
 * Skips undefined/null values. Converts booleans to string "true"/"false".
 */
export function buildQueryParams<T extends object>(
  filters: T | undefined,
): Record<string, unknown> {
  if (!filters) return {};

  const params: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue;

    if (typeof value === 'boolean') {
      params[key] = String(value);
    } else {
      params[key] = value;
    }
  }

  return params;
}
