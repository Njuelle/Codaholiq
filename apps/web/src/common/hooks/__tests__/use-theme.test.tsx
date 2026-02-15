import { renderHook, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../use-theme';
import type { Theme } from '../use-theme';
import type { ReactNode, ReactElement } from 'react';

function createWrapper(
  defaultTheme?: Theme,
): ({ children }: { children: ReactNode }) => ReactElement {
  return function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return <ThemeProvider defaultTheme={defaultTheme}>{children}</ThemeProvider>;
  };
}

describe('useTheme', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('should throw when used outside ThemeProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useTheme())).toThrow(
      'useTheme must be used within a ThemeProvider',
    );
    spy.mockRestore();
  });

  it('should default to system theme', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: createWrapper(),
    });
    expect(result.current.theme).toBe('system');
  });

  it('should resolve system theme to light when prefers-color-scheme is light', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: createWrapper(),
    });
    expect(result.current.resolvedTheme).toBe('light');
  });

  it('should switch to dark theme and apply dark class', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should switch to light theme and remove dark class', () => {
    document.documentElement.classList.add('dark');

    const { result } = renderHook(() => useTheme(), {
      wrapper: createWrapper('dark'),
    });

    act(() => {
      result.current.setTheme('light');
    });

    expect(result.current.resolvedTheme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should persist theme selection to localStorage', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setTheme('dark');
    });

    const stored = localStorage.getItem('codaholiq-theme');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toBe('dark');
  });

  it('should read persisted theme from localStorage', () => {
    localStorage.setItem('codaholiq-theme', JSON.stringify('dark'));

    const { result } = renderHook(() => useTheme(), {
      wrapper: createWrapper(),
    });

    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
  });
});
