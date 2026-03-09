import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '@/test/test-utils';
import { mockOrg, mockUser } from '@/test/factories';
import { server } from '@/test/msw-server';
import { AnalyticsPage } from '../analytics';
import type { AnalyticsData } from '../../types';

// Mock ResizeObserver for recharts + Radix Select polyfills for jsdom
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const testUser = mockUser({ id: 1, username: 'testuser' });
const testOrg = mockOrg({ id: 1, name: 'Test Org', slug: 'test-org' });

const mockAnalyticsData: AnalyticsData = {
  series: [
    {
      date: '2026-01-15',
      totalCostMicros: 2_000_000,
      totalInputTokens: 50_000,
      totalOutputTokens: 10_000,
      executionCount: 5,
    },
    {
      date: '2026-01-16',
      totalCostMicros: 3_000_000,
      totalInputTokens: 75_000,
      totalOutputTokens: 15_000,
      executionCount: 8,
    },
  ],
  summary: {
    totalCostMicros: 5_000_000,
    totalInputTokens: 125_000,
    totalOutputTokens: 25_000,
    executionsWithCost: 13,
    averageCostMicros: 384_615,
  },
  costByProvider: [
    { provider: 'claude-code', model: 'opus', totalCostMicros: 4_000_000, count: 10 },
    { provider: 'codex', model: null, totalCostMicros: 1_000_000, count: 3 },
  ],
  topCostliestAutomations: [
    {
      automationId: 1,
      automationName: 'PR Review Bot',
      totalCostMicros: 3_000_000,
      executionCount: 7,
      totalInputTokens: 80_000,
      totalOutputTokens: 18_000,
    },
  ],
};

function renderPage(): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <Routes>
      <Route path="/orgs/:orgId/analytics" element={<AnalyticsPage />} />
    </Routes>,
    { initialRoute: '/orgs/1/analytics', user: testUser, org: testOrg },
  );
}

describe('AnalyticsPage', () => {
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

  it('should render the page heading', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Cost & Usage' })).toBeInTheDocument();
  });

  it('should render date range preset buttons', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: '7d' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30d' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '90d' })).toBeInTheDocument();
  });

  it('should render repository selector with "All Repositories" by default', async () => {
    renderPage();
    expect(await screen.findByText('All Repositories')).toBeInTheDocument();
  });

  it('should render summary cards with data', async () => {
    renderPage();
    expect(await screen.findByText('$5.00')).toBeInTheDocument();
    expect(screen.getAllByText('Total Cost').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Avg Cost / Execution')).toBeInTheDocument();
  });

  it('should render cost over time chart', async () => {
    renderPage();
    expect(await screen.findByText('Cost Over Time')).toBeInTheDocument();
  });

  it('should render cost by provider chart', async () => {
    renderPage();
    expect(await screen.findByText('Cost by Provider')).toBeInTheDocument();
  });

  it('should render top costliest automations table', async () => {
    renderPage();
    expect(await screen.findByText('Top Costliest Automations')).toBeInTheDocument();
    expect(screen.getByText('PR Review Bot')).toBeInTheDocument();
  });

  it('should show loading state while data is loading', () => {
    server.use(
      http.get('/api/orgs/:orgId/analytics/cost-over-time', () => {
        return new Promise(() => {});
      }),
    );

    renderPage();
    expect(screen.getByText('Loading analytics...')).toBeInTheDocument();
  });

  it('should switch preset when clicking a preset button', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('$5.00');

    await user.click(screen.getByRole('button', { name: '7d' }));

    // Should still render the page (new data will be fetched)
    expect(screen.getByRole('heading', { name: 'Cost & Usage' })).toBeInTheDocument();
  });
});
