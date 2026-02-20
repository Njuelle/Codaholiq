import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { useCreateWorkflowPR } from '../use-create-workflow-pr';
import type { ReactNode } from 'react';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe('useCreateWorkflowPR', () => {
  it('should create workflow PR successfully', async () => {
    const { result } = renderHook(() => useCreateWorkflowPR({ orgId: 1, repoId: 1 }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.pullRequestUrl).toBe('https://github.com/test-org/repo-1/pull/1');
  });

  it('should handle error when workflow file already exists', async () => {
    server.use(
      http.post('/api/orgs/:orgId/repos/:repoId/setup-workflow', () => {
        return HttpResponse.json(
          {
            statusCode: 400,
            error: 'Bad Request',
            message: 'Workflow file already exists in this repository',
          },
          { status: 400 },
        );
      }),
    );

    const { result } = renderHook(() => useCreateWorkflowPR({ orgId: 1, repoId: 1 }), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
