import { resolvePayloadPath, resolvePayloadPathAsString } from '../payload-path.util';

describe('resolvePayloadPath', () => {
  it('should resolve a top-level key', () => {
    expect(resolvePayloadPath({ path: 'ref', payload: { ref: 'refs/heads/main' } })).toBe(
      'refs/heads/main',
    );
  });

  it('should resolve a nested path', () => {
    const payload = { pull_request: { base: { ref: 'main' } } };
    expect(resolvePayloadPath({ path: 'pull_request.base.ref', payload })).toBe('main');
  });

  it('should return undefined for missing top-level key', () => {
    expect(resolvePayloadPath({ path: 'missing', payload: {} })).toBeUndefined();
  });

  it('should return undefined for missing intermediate segment', () => {
    const payload = { pull_request: { base: {} } };
    expect(resolvePayloadPath({ path: 'pull_request.head.ref', payload })).toBeUndefined();
  });

  it('should return undefined when intermediate is null', () => {
    const payload = { pull_request: null };
    expect(
      resolvePayloadPath({
        path: 'pull_request.base.ref',
        payload: payload as unknown as Record<string, unknown>,
      }),
    ).toBeUndefined();
  });

  it('should return undefined when intermediate is a primitive', () => {
    const payload = { count: 42 };
    expect(resolvePayloadPath({ path: 'count.value', payload })).toBeUndefined();
  });

  it('should return objects as-is', () => {
    const nested = { id: 1, name: 'bug' };
    const payload = { label: nested };
    expect(resolvePayloadPath({ path: 'label', payload })).toEqual(nested);
  });

  it('should return arrays as-is', () => {
    const labels = [{ name: 'bug' }, { name: 'priority' }];
    const payload = { pull_request: { labels } };
    expect(resolvePayloadPath({ path: 'pull_request.labels', payload })).toEqual(labels);
  });

  it('should return booleans', () => {
    const payload = { pull_request: { draft: false } };
    expect(resolvePayloadPath({ path: 'pull_request.draft', payload })).toBe(false);
  });

  it('should return numbers', () => {
    const payload = { pull_request: { number: 42 } };
    expect(resolvePayloadPath({ path: 'pull_request.number', payload })).toBe(42);
  });

  it('should treat null leaf value as undefined', () => {
    const payload = { value: null };
    expect(resolvePayloadPath({ path: 'value', payload })).toBeUndefined();
  });

  // ── Prototype traversal prevention ──────────────────────────────

  it('should return undefined for __proto__ segment', () => {
    expect(resolvePayloadPath({ path: '__proto__', payload: {} })).toBeUndefined();
  });

  it('should return undefined for constructor segment', () => {
    expect(resolvePayloadPath({ path: 'constructor', payload: {} })).toBeUndefined();
  });

  it('should return undefined for prototype segment', () => {
    expect(resolvePayloadPath({ path: 'prototype', payload: {} })).toBeUndefined();
  });

  it('should return undefined for nested __proto__ segment', () => {
    const payload = { a: { b: 'value' } };
    expect(resolvePayloadPath({ path: 'a.__proto__', payload })).toBeUndefined();
  });

  it('should return undefined for __proto__.toString traversal', () => {
    expect(resolvePayloadPath({ path: '__proto__.toString', payload: {} })).toBeUndefined();
  });

  it('should return undefined for constructor.prototype traversal', () => {
    expect(resolvePayloadPath({ path: 'constructor.prototype', payload: {} })).toBeUndefined();
  });
});

describe('resolvePayloadPathAsString', () => {
  it('should return strings directly', () => {
    expect(resolvePayloadPathAsString({ path: 'ref', payload: { ref: 'main' } })).toBe('main');
  });

  it('should coerce booleans to string', () => {
    expect(resolvePayloadPathAsString({ path: 'draft', payload: { draft: true } })).toBe('true');
  });

  it('should coerce numbers to string', () => {
    expect(resolvePayloadPathAsString({ path: 'number', payload: { number: 42 } })).toBe('42');
  });

  it('should JSON-stringify objects', () => {
    const label = { id: 1, name: 'bug' };
    expect(resolvePayloadPathAsString({ path: 'label', payload: { label } })).toBe(
      JSON.stringify(label),
    );
  });

  it('should return undefined for missing path', () => {
    expect(resolvePayloadPathAsString({ path: 'missing', payload: {} })).toBeUndefined();
  });
});
