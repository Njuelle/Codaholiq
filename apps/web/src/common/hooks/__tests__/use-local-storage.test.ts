import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../use-local-storage';

describe('useLocalStorage', () => {
  it('should return default value when no stored value', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
    expect(result.current[0]).toBe('default');
  });

  it('should return stored value when present', () => {
    localStorage.setItem('stored-key', JSON.stringify('saved'));
    const { result } = renderHook(() => useLocalStorage('stored-key', 'default'));
    expect(result.current[0]).toBe('saved');
  });

  it('should update value and persist to localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('update-key', 'initial'));

    act(() => {
      result.current[1]('updated');
    });

    expect(result.current[0]).toBe('updated');
    expect(JSON.parse(localStorage.getItem('update-key')!)).toBe('updated');
  });

  it('should support updater function', () => {
    const { result } = renderHook(() => useLocalStorage('counter-key', 0));

    act(() => {
      result.current[1]((prev) => prev + 1);
    });

    expect(result.current[0]).toBe(1);
  });

  it('should handle complex objects', () => {
    const defaultObj = { name: 'test', count: 0 };
    const { result } = renderHook(() => useLocalStorage('obj-key', defaultObj));

    act(() => {
      result.current[1]({ name: 'updated', count: 5 });
    });

    expect(result.current[0]).toEqual({ name: 'updated', count: 5 });
  });

  it('should return default on parse error', () => {
    localStorage.setItem('bad-key', 'not-json{');
    const { result } = renderHook(() => useLocalStorage('bad-key', 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });
});
