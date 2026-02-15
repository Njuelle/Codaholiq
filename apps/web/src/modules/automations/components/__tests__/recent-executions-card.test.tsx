import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/test-utils';
import { server } from '@/test/msw-server';
import { mockExecution } from '@/test/factories';
import { RecentExecutionsCard } from '../recent-executions-card';

describe('RecentExecutionsCard', () => {
  it('should render execution status badges', async () => {
    server.use(
      http.get('/api/orgs/:orgId/executions', () => {
        return HttpResponse.json({
          data: {
            items: [
              {
                execution: mockExecution({ id: 1, status: 'completed' }),
                automationName: 'Test Automation',
              },
              {
                execution: mockExecution({ id: 2, status: 'failed', completedAt: null }),
                automationName: 'Test Automation',
              },
              {
                execution: mockExecution({
                  id: 3,
                  status: 'running',
                  startedAt: '2025-01-01T00:00:00.000Z',
                  completedAt: null,
                }),
                automationName: 'Test Automation',
              },
            ],
            meta: { total: 3, limit: 5, offset: 0 },
          },
          requestId: 'test-request-id',
        });
      }),
    );

    renderWithProviders(<RecentExecutionsCard orgId={1} automationId={1} />);

    expect(await screen.findByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    // Use a handler that delays indefinitely so loading state persists
    server.use(
      http.get('/api/orgs/:orgId/executions', () => {
        return new Promise(() => {
          // Never resolves — keeps loading state
        });
      }),
    );

    renderWithProviders(<RecentExecutionsCard orgId={1} automationId={1} />);

    expect(screen.getByText('Recent Executions')).toBeInTheDocument();
    // Loading skeleton renders divs with skeleton classes, no table should be visible
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('No executions yet.')).not.toBeInTheDocument();
  });

  it('should show empty state when no executions', async () => {
    server.use(
      http.get('/api/orgs/:orgId/executions', () => {
        return HttpResponse.json({
          data: {
            items: [],
            meta: { total: 0, limit: 5, offset: 0 },
          },
          requestId: 'test-request-id',
        });
      }),
    );

    renderWithProviders(<RecentExecutionsCard orgId={1} automationId={1} />);

    expect(await screen.findByText('No executions yet.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('should render the "View all" link', async () => {
    renderWithProviders(<RecentExecutionsCard orgId={1} automationId={5} />);

    const viewAllLink = await screen.findByRole('link', { name: /view all/i });
    expect(viewAllLink).toBeInTheDocument();
    expect(viewAllLink).toHaveAttribute('href', '/orgs/1/executions?automationId=5');
  });

  it('should render table headers when executions exist', async () => {
    renderWithProviders(<RecentExecutionsCard orgId={1} automationId={1} />);

    expect(await screen.findByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
  });

  it('should display duration for completed executions', async () => {
    server.use(
      http.get('/api/orgs/:orgId/executions', () => {
        return HttpResponse.json({
          data: {
            items: [
              {
                execution: mockExecution({
                  id: 1,
                  status: 'completed',
                  startedAt: '2025-01-01T00:00:00.000Z',
                  completedAt: '2025-01-01T00:01:30.000Z',
                }),
                automationName: 'Test Automation',
              },
            ],
            meta: { total: 1, limit: 5, offset: 0 },
          },
          requestId: 'test-request-id',
        });
      }),
    );

    renderWithProviders(<RecentExecutionsCard orgId={1} automationId={1} />);

    expect(await screen.findByText('1m 30s')).toBeInTheDocument();
  });

  it('should display "-" for duration when execution has no startedAt', async () => {
    server.use(
      http.get('/api/orgs/:orgId/executions', () => {
        return HttpResponse.json({
          data: {
            items: [
              {
                execution: mockExecution({
                  id: 1,
                  status: 'pending',
                  startedAt: null,
                  completedAt: null,
                }),
                automationName: 'Test Automation',
              },
            ],
            meta: { total: 1, limit: 5, offset: 0 },
          },
          requestId: 'test-request-id',
        });
      }),
    );

    renderWithProviders(<RecentExecutionsCard orgId={1} automationId={1} />);

    expect(await screen.findByText('-')).toBeInTheDocument();
  });
});
