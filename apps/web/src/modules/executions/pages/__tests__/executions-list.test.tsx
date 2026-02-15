import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '@/test/test-utils';
import { mockExecution, mockOrg, mockUser } from '@/test/factories';
import { server } from '@/test/msw-server';
import { ExecutionsListPage } from '../executions-list';

const testUser = mockUser({ id: 1, username: 'testuser' });
const testOrg = mockOrg({ id: 1, name: 'Test Org', slug: 'test-org' });

function renderPage(): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <Routes>
      <Route path="/orgs/:orgId/executions" element={<ExecutionsListPage />} />
    </Routes>,
    { initialRoute: '/orgs/1/executions', user: testUser, org: testOrg },
  );
}

describe('ExecutionsListPage', () => {
  it('should render the page heading and description', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Executions' })).toBeInTheDocument();
    expect(screen.getByText('Monitor your automation executions.')).toBeInTheDocument();
  });

  it('should render executions table with data', async () => {
    server.use(
      http.get('/api/orgs/:orgId/executions', () => {
        return HttpResponse.json({
          data: {
            items: [
              {
                execution: mockExecution({ id: 1, status: 'completed' }),
                automationName: 'PR Review Bot',
              },
              {
                execution: mockExecution({ id: 2, status: 'failed' }),
                automationName: 'Nightly Build',
              },
            ],
            meta: { total: 2, limit: 20, offset: 0 },
          },
          requestId: 'test-request-id',
        });
      }),
    );

    renderPage();

    expect(await screen.findByText('PR Review Bot')).toBeInTheDocument();
    expect(screen.getByText('Nightly Build')).toBeInTheDocument();
  });

  it('should show loading skeletons while data is loading', () => {
    server.use(
      http.get('/api/orgs/:orgId/executions', () => {
        return new Promise(() => {});
      }),
    );

    renderPage();

    expect(screen.getByRole('heading', { name: 'Executions' })).toBeInTheDocument();

    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render empty state when no executions exist', async () => {
    server.use(
      http.get('/api/orgs/:orgId/executions', () => {
        return HttpResponse.json({
          data: { items: [], meta: { total: 0, limit: 20, offset: 0 } },
          requestId: 'test-request-id',
        });
      }),
    );

    renderPage();

    expect(await screen.findByText('No executions found')).toBeInTheDocument();
    expect(
      screen.getByText('Executions will appear here when your automations run.'),
    ).toBeInTheDocument();
  });

  it('should render error state when fetch fails', async () => {
    server.use(
      http.get('/api/orgs/:orgId/executions', () => {
        return HttpResponse.json(
          {
            statusCode: 500,
            error: 'Internal Server Error',
            message: 'DB down',
          },
          { status: 500 },
        );
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/failed to load executions/i)).toBeInTheDocument();
    });
  });

  it('should render pagination buttons when executions are loaded', async () => {
    renderPage();

    await screen.findByText('Test Automation');

    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });

  it('should disable Previous button on the first page', async () => {
    renderPage();

    await screen.findByText('Test Automation');

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });
});
