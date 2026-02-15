import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { useAutomationExecutions } from '../use-automation-executions';
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

describe('useAutomationExecutions', () => {
  it('should return recent executions', async () => {
    const { result } = renderHook(() => useAutomationExecutions({ orgId: 1, automationId: 1 }), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.executions).toHaveLength(1);
    expect(result.current.executions[0]!.automationName).toBe('Test Automation');
    expect(result.current.executions[0]!.execution.status).toBe('completed');
  });
});
