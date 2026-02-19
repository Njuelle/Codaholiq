import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '@/test/test-utils';
import { mockAutomation, mockOrg, mockUser } from '@/test/factories';
import { server } from '@/test/msw-server';
import { AutomationsListPage } from '../automations-list';

const testUser = mockUser({ id: 1, username: 'testuser' });
const testOrg = mockOrg({ id: 1, name: 'Test Org', slug: 'test-org' });

function renderPage(): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <Routes>
      <Route path="/orgs/:orgId/automations" element={<AutomationsListPage />} />
    </Routes>,
    { initialRoute: '/orgs/1/automations', user: testUser, org: testOrg },
  );
}

describe('AutomationsListPage', () => {
  it('should render the page heading and description', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Automations' })).toBeInTheDocument();
    expect(screen.getByText('Manage your GitHub automations.')).toBeInTheDocument();
  });

  it('should render the "New Automation" link', async () => {
    renderPage();

    const newLink = await screen.findByRole('link', {
      name: /new automation/i,
    });
    expect(newLink).toBeInTheDocument();
    expect(newLink).toHaveAttribute('href', '/orgs/1/automations/new');
  });

  it('should render automations table with data', async () => {
    server.use(
      http.get('/api/orgs/:orgId/automations', () => {
        return HttpResponse.json({
          data: [
            mockAutomation({ id: 1, name: 'PR Review Bot', enabled: true }),
            mockAutomation({
              id: 2,
              name: 'Nightly Cron',
              triggerType: 'cron',
              enabled: false,
            }),
          ],
          requestId: 'test-request-id',
        });
      }),
    );

    renderPage();

    expect(await screen.findByText('PR Review Bot')).toBeInTheDocument();
    expect(screen.getByText('Nightly Cron')).toBeInTheDocument();
  });

  it('should show loading skeletons while data is loading', () => {
    server.use(
      http.get('/api/orgs/:orgId/automations', () => {
        // Never resolve to keep loading state
        return new Promise(() => {});
      }),
    );

    renderPage();

    // The page header should render immediately
    expect(screen.getByRole('heading', { name: 'Automations' })).toBeInTheDocument();

    // Loading skeletons are rendered (Skeleton components with specific classes)
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render empty state when no automations exist', async () => {
    server.use(
      http.get('/api/orgs/:orgId/automations', () => {
        return HttpResponse.json({
          data: [],
          requestId: 'test-request-id',
        });
      }),
    );

    renderPage();

    expect(await screen.findByText('No automations yet')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Create your first automation to start running Claude Code on your repositories.',
      ),
    ).toBeInTheDocument();
  });

  it('should render error state when fetch fails', async () => {
    server.use(
      http.get('/api/orgs/:orgId/automations', () => {
        return HttpResponse.json(
          { statusCode: 500, error: 'Internal Server Error', message: 'DB down' },
          { status: 500 },
        );
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/failed to load automations/i)).toBeInTheDocument();
    });
  });

  it('should render pagination buttons when automations are loaded', async () => {
    server.use(
      http.get('/api/orgs/:orgId/automations', () => {
        return HttpResponse.json({
          data: [mockAutomation({ id: 1, name: 'Test Auto' })],
          requestId: 'test-request-id',
        });
      }),
    );

    renderPage();

    await screen.findByText('Test Auto');

    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });

  it('should disable Previous button on the first page', async () => {
    renderPage();

    // Wait for data to load using default handlers
    await screen.findByText('Test Automation');

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });

  it('should enable Next button when a full page of results is returned', async () => {
    server.use(
      http.get('/api/orgs/:orgId/automations', () => {
        // Return exactly 20 items (PAGE_SIZE) to enable Next
        const items = Array.from({ length: 20 }, (_, i) =>
          mockAutomation({ id: i + 1, name: `Auto ${i + 1}` }),
        );
        return HttpResponse.json({ data: items, requestId: 'test-request-id' });
      }),
    );

    renderPage();

    await screen.findByText('Auto 1');

    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  it('should open delete confirmation via dropdown menu', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('/api/orgs/:orgId/automations', () => {
        return HttpResponse.json({
          data: [mockAutomation({ id: 1, name: 'To Delete' })],
          requestId: 'test-request-id',
        });
      }),
    );

    renderPage();

    await screen.findByText('To Delete');

    // Open the dropdown menu
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    // Click Delete in the dropdown
    await user.click(screen.getByText('Delete'));

    expect(await screen.findByText('Delete Automation')).toBeInTheDocument();
    expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();
  });
});
