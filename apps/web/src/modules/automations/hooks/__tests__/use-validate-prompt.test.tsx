import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { useValidatePrompt } from '../use-validate-prompt';
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

describe('useValidatePrompt', () => {
  it('should validate prompt and return resolved prompt and variables', async () => {
    const { result } = renderHook(() => useValidatePrompt({ orgId: 1, automationId: 1 }), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      promptTemplate: 'Fix {{file}} on {{branch}}',
      sampleVariables: { file: 'src/main.ts', branch: 'main' },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({
      resolvedPrompt: 'Resolved prompt text',
      variables: ['file', 'branch'],
    });
  });

  it('should handle validation error', async () => {
    server.use(
      http.post('/api/orgs/:orgId/automations/:automationId/validate-prompt', () => {
        return HttpResponse.json(
          { statusCode: 400, error: 'Bad Request', message: 'Invalid template syntax' },
          { status: 400 },
        );
      }),
    );

    const { result } = renderHook(() => useValidatePrompt({ orgId: 1, automationId: 1 }), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ promptTemplate: '{{invalid' });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
