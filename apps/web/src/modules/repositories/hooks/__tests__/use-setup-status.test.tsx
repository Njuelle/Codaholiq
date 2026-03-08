import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { useSetupStatus } from '../use-setup-status';
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

describe('useSetupStatus', () => {
  it('should return workflowFileExists true when configured', async () => {
    const { result } = renderHook(() => useSetupStatus({ orgId: 1, repoId: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 5000 },
    );

    expect(result.current.workflowFileExists).toBe(true);
    expect(result.current.workflowFileUpToDate).toBe(true);
  });

  it('should return secrets status from API', async () => {
    const { result } = renderHook(() => useSetupStatus({ orgId: 1, repoId: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 5000 },
    );

    expect(result.current.secretsConfigured).toBe(true);
    expect(result.current.hasAnthropicKey).toBe(true);
    expect(result.current.hasOAuthToken).toBe(false);
  });

  it('should return workflowFileExists false when not configured', async () => {
    server.use(
      http.get('/api/orgs/:orgId/repos/:repoId/setup-status', () => {
        return HttpResponse.json({
          data: {
            workflowFileExists: false,
            workflowFileUpToDate: false,
            secretsConfigured: false,
            hasAnthropicKey: false,
            hasOAuthToken: false,
          },
          requestId: 'test-request-id',
        });
      }),
    );

    const { result } = renderHook(() => useSetupStatus({ orgId: 1, repoId: 1 }), {
      wrapper: createWrapper(),
    });

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 5000 },
    );

    expect(result.current.workflowFileExists).toBe(false);
    expect(result.current.secretsConfigured).toBe(false);
  });

  it('should not fetch when repoId is 0', () => {
    const { result } = renderHook(() => useSetupStatus({ orgId: 1, repoId: 0 }), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.workflowFileExists).toBeUndefined();
    expect(result.current.secretsConfigured).toBeUndefined();
  });
});
