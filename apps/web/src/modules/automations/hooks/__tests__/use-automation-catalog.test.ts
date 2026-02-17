import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { useAutomationCatalog } from '../use-automation-catalog';
import type { ReactNode } from 'react';
import { createElement } from 'react';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useAutomationCatalog', () => {
  it('should return categories from the API', async () => {
    const { result } = renderHook(() => useAutomationCatalog(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.categories).toHaveLength(2);
    expect(result.current.categories[0]?.name).toBe('Code Quality');
    expect(result.current.categories[1]?.name).toBe('Security');
  });

  it('should return empty categories while loading', () => {
    server.use(
      http.get('/api/automation-catalog', () => {
        return new Promise(() => {
          // Never resolves
        });
      }),
    );

    const { result } = renderHook(() => useAutomationCatalog(), {
      wrapper: createWrapper(),
    });

    expect(result.current.categories).toHaveLength(0);
    expect(result.current.isLoading).toBe(true);
  });

  it('should set isError on failure', async () => {
    server.use(
      http.get('/api/automation-catalog', () => {
        return HttpResponse.json(null, { status: 500 });
      }),
    );

    const { result } = renderHook(() => useAutomationCatalog(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
