import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { useAnalytics } from '../use-analytics';
import type { AnalyticsData } from '../../types';
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

const mockAnalyticsData: AnalyticsData = {
  series: [
    {
      date: '2026-01-15',
      totalCostMicros: 500_000,
      totalInputTokens: 1000,
      totalOutputTokens: 500,
      executionCount: 2,
    },
  ],
  summary: {
    totalCostMicros: 500_000,
    totalInputTokens: 1000,
    totalOutputTokens: 500,
    executionsWithCost: 2,
    averageCostMicros: 250_000,
  },
  costByProvider: [{ provider: 'claude-code', model: 'opus', totalCostMicros: 500_000, count: 2 }],
  topCostliestAutomations: [],
};

const dateRange = {
  from: new Date('2026-01-01T00:00:00Z'),
  to: new Date('2026-02-01T00:00:00Z'),
};

describe('useAnalytics', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/orgs/:orgId/analytics/cost-over-time', () => {
        return HttpResponse.json({
          data: mockAnalyticsData,
          requestId: 'test-request-id',
        });
      }),
    );
  });

  it('should return analytics data on success', async () => {
    const { result } = renderHook(() => useAnalytics({ orgId: 1, dateRange }), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).not.toBeNull();
    expect(result.current.data!.series).toHaveLength(1);
    expect(result.current.data!.summary.totalCostMicros).toBe(500_000);
  });

  it('should handle API error', async () => {
    server.use(
      http.get('/api/orgs/:orgId/analytics/cost-over-time', () => {
        return HttpResponse.json(
          { statusCode: 500, error: 'Internal Server Error', message: 'Error' },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHook(() => useAnalytics({ orgId: 1, dateRange }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.data).toBeNull();
  });

  it('should not fetch when orgId is 0', () => {
    const { result } = renderHook(() => useAnalytics({ orgId: 0, dateRange }), {
      wrapper: createWrapper(),
    });

    // Query is disabled, so no data and no error
    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(false);
  });

  it('should include repoId in query params when provided', async () => {
    let capturedUrl = '';
    server.use(
      http.get('/api/orgs/:orgId/analytics/cost-over-time', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: mockAnalyticsData,
          requestId: 'test-request-id',
        });
      }),
    );

    const { result } = renderHook(() => useAnalytics({ orgId: 1, dateRange, repoId: 42 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(capturedUrl).toContain('repoId=42');
  });

  it('should not include repoId in query params when undefined', async () => {
    let capturedUrl = '';
    server.use(
      http.get('/api/orgs/:orgId/analytics/cost-over-time', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: mockAnalyticsData,
          requestId: 'test-request-id',
        });
      }),
    );

    const { result } = renderHook(() => useAnalytics({ orgId: 1, dateRange }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(capturedUrl).not.toContain('repoId');
  });
});
