import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '@/test/test-utils';
import { mockOrg, mockUser } from '@/test/factories';
import { server } from '@/test/msw-server';
import { DashboardPage } from '../dashboard';

const testUser = mockUser({ id: 1, username: 'testuser' });
const testOrg = mockOrg({ id: 1, name: 'Test Org', slug: 'test-org' });

function renderPage(): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <Routes>
      <Route path="/orgs/:orgId/dashboard" element={<DashboardPage />} />
    </Routes>,
    { initialRoute: '/orgs/1/dashboard', user: testUser, org: testOrg },
  );
}

describe('DashboardPage', () => {
  it('should render the dashboard heading', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('should render stat cards', async () => {
    renderPage();

    expect(await screen.findByText('Active Automations')).toBeInTheDocument();
    expect(screen.getByText('Repositories')).toBeInTheDocument();
    expect(screen.getByText('Executions (24h)')).toBeInTheDocument();
    expect(screen.getByText('Success Rate (24h)')).toBeInTheDocument();
  });

  it('should render recent executions', async () => {
    renderPage();

    expect(await screen.findByText('Recent Executions')).toBeInTheDocument();
    expect(screen.getByText('PR Review Bot')).toBeInTheDocument();
  });

  it('should render upcoming cron triggers', async () => {
    renderPage();

    expect(await screen.findByText('Upcoming Cron Triggers')).toBeInTheDocument();
  });

  it('should render execution stats tabs', async () => {
    renderPage();

    expect(await screen.findByText('Execution Stats')).toBeInTheDocument();
    expect(screen.getAllByRole('tab', { name: '24 Hours' }).length).toBeGreaterThanOrEqual(1);
  });

  it('should render cost overview card', async () => {
    renderPage();

    expect(await screen.findByText('Cost Overview')).toBeInTheDocument();
  });

  it('should render top costliest automations card', async () => {
    renderPage();

    expect(await screen.findByText('Top Costliest Automations (30d)')).toBeInTheDocument();
  });

  it('should show loading skeletons while data is loading', () => {
    server.use(
      http.get('/api/orgs/:orgId/dashboard', () => {
        return new Promise(() => {});
      }),
    );

    renderPage();

    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render error state when fetch fails', async () => {
    server.use(
      http.get('/api/orgs/:orgId/dashboard', () => {
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
      expect(screen.getByText(/failed to load dashboard/i)).toBeInTheDocument();
    });
  });
});
