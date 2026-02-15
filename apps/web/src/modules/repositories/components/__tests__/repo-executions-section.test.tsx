import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/test-utils';
import { mockExecution } from '@/test/factories';
import { RepoExecutionsSection } from '../repo-executions-section';

describe('RepoExecutionsSection', () => {
  it('should render recent executions', async () => {
    server.use(
      http.get('/api/orgs/:orgId/executions', () => {
        return HttpResponse.json({
          data: {
            items: [
              {
                execution: mockExecution({ id: 1, status: 'completed' }),
                automationName: 'Deploy Bot',
              },
              {
                execution: mockExecution({ id: 2, status: 'failed' }),
                automationName: 'Test Runner',
              },
            ],
            meta: { total: 2, limit: 5, offset: 0 },
          },
          requestId: 'test-request-id',
        });
      }),
    );

    renderWithProviders(<RepoExecutionsSection orgId={1} repoId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Deploy Bot')).toBeInTheDocument();
    });

    expect(screen.getByText('Test Runner')).toBeInTheDocument();
  });

  it('should show empty state when no executions', async () => {
    server.use(
      http.get('/api/orgs/:orgId/executions', () => {
        return HttpResponse.json({
          data: { items: [], meta: { total: 0, limit: 5, offset: 0 } },
          requestId: 'test-request-id',
        });
      }),
    );

    renderWithProviders(<RepoExecutionsSection orgId={1} repoId={1} />);

    await waitFor(() => {
      expect(screen.getByText('No executions yet.')).toBeInTheDocument();
    });
  });

  it('should show view all link', () => {
    renderWithProviders(<RepoExecutionsSection orgId={1} repoId={1} />);

    expect(screen.getByText('View all')).toBeInTheDocument();
  });
});
