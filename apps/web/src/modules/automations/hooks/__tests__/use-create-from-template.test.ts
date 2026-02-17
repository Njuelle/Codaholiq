import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { useCreateFromTemplate } from '../use-create-from-template';
import type { ReactNode } from 'react';
import { createElement } from 'react';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

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

describe('useCreateFromTemplate', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('should navigate to automation detail on success', async () => {
    const { result } = renderHook(
      () => useCreateFromTemplate({ orgId: 1 }),
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.mutate({ templateSlug: 'pr-code-review', repoId: 1 });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/orgs/1/automations/200');
  });

  it('should handle error', async () => {
    server.use(
      http.post('/api/orgs/:orgId/automations/from-template', () => {
        return HttpResponse.json(null, { status: 500 });
      }),
    );

    const { result } = renderHook(
      () => useCreateFromTemplate({ orgId: 1 }),
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.mutate({ templateSlug: 'bad', repoId: 1 });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
