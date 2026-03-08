import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { useCreateAutomation } from '../use-create-automation';
import type { AutomationFormValues } from '@/modules/automations/lib/automation-schemas';
import type { ReactNode } from 'react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
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
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

const validPayload: AutomationFormValues = {
  name: 'New Automation',
  description: null,
  repoId: 1,
  promptTemplate: 'Fix {{file}}',
  provider: 'claude-code',
  model: null,
  enabled: true,
  monthlyCostLimitMicros: null,
  variables: [],
  triggerType: 'manual',
  triggerConfig: {},
};

describe('useCreateAutomation', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('should create automation successfully', async () => {
    const { result } = renderHook(() => useCreateAutomation({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    result.current.mutate(validPayload);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/orgs/1/automations/100');
  });

  it('should handle create error', async () => {
    server.use(
      http.post('/api/orgs/:orgId/automations', () => {
        return HttpResponse.json(
          { statusCode: 422, error: 'Unprocessable Entity', message: 'Validation failed' },
          { status: 422 },
        );
      }),
    );

    const { result } = renderHook(() => useCreateAutomation({ orgId: 1 }), {
      wrapper: createWrapper(),
    });

    result.current.mutate(validPayload);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
