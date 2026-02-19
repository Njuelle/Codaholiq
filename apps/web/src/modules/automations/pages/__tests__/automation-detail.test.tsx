import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '@/test/test-utils';
import { mockAutomationWithVariables, mockOrg, mockUser } from '@/test/factories';
import { server } from '@/test/msw-server';
import { AutomationDetailPage } from '../automation-detail';

const testUser = mockUser({ id: 1, username: 'testuser' });
const testOrg = mockOrg({ id: 1, name: 'Test Org', slug: 'test-org' });

function renderPage(): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <Routes>
      <Route path="/orgs/:orgId/automations/:automationId" element={<AutomationDetailPage />} />
    </Routes>,
    {
      initialRoute: '/orgs/1/automations/1',
      user: testUser,
      org: testOrg,
    },
  );
}

describe('AutomationDetailPage', () => {
  it('should render loading skeleton initially', () => {
    server.use(
      http.get('/api/orgs/:orgId/automations/:automationId', () => {
        return new Promise(() => {});
      }),
    );

    renderPage();

    // Skeleton elements should be present during loading
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render automation detail info after loading', async () => {
    server.use(
      http.get('/api/orgs/:orgId/automations/:automationId', () => {
        return HttpResponse.json({
          data: mockAutomationWithVariables({
            id: 1,
            name: 'PR Review Automation',
            description: 'Automatically reviews pull requests',
            triggerType: 'event',
            triggerConfig: { events: ['pull_request.opened'] },
            promptTemplate: 'Review the PR changes',
            workflowFile: '.github/workflows/codaholiq.yml',
            enabled: true,
          }),
          requestId: 'test-request-id',
        });
      }),
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

    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'PR Review Automation' }),
    ).toBeInTheDocument();
    // Description appears in both PageHeader and the detail card
    const descriptions = screen.getAllByText('Automatically reviews pull requests');
    expect(descriptions.length).toBeGreaterThanOrEqual(1);
  });

  it('should render Edit, Delete, and Trigger buttons', async () => {
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

    renderPage();

    // Wait for data to load (default handler returns "Test Automation")
    await screen.findByRole('heading', { name: 'Test Automation' });

    expect(screen.getByRole('link', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /trigger/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('should render the enable/disable switch', async () => {
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

    renderPage();

    await screen.findByRole('heading', { name: 'Test Automation' });

    // The switch should be present with an accessible label
    expect(screen.getByRole('switch', { name: /disable automation/i })).toBeInTheDocument();
    expect(screen.getByText('Enabled')).toBeInTheDocument();
  });

  it('should render error state when fetch fails', async () => {
    server.use(
      http.get('/api/orgs/:orgId/automations/:automationId', () => {
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

    // The error message from the API response is displayed
    expect(await screen.findByText('DB down')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /back to automations/i })).toBeInTheDocument();
  });

  it('should render the Edit link with correct href', async () => {
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

    renderPage();

    await screen.findByRole('heading', { name: 'Test Automation' });

    const editLink = screen.getByRole('link', { name: /edit/i });
    expect(editLink).toHaveAttribute('href', '/orgs/1/automations/1/edit');
  });

  it('should render detail cards for automation info', async () => {
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

    renderPage();

    await screen.findByRole('heading', { name: 'Test Automation' });

    // Detail cards should be rendered
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.getByText('Prompt Template')).toBeInTheDocument();
    expect(screen.getByText('Variables')).toBeInTheDocument();
    expect(screen.getByText('Recent Executions')).toBeInTheDocument();
  });

  it('should open disable dialog when toggling an enabled automation', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('/api/orgs/:orgId/automations/:automationId', () => {
        return HttpResponse.json({
          data: mockAutomationWithVariables({ id: 1, name: 'My Auto', enabled: true }),
          requestId: 'test-request-id',
        });
      }),
      http.get('/api/orgs/:orgId/executions', () => {
        return HttpResponse.json({
          data: { items: [], meta: { total: 0, limit: 5, offset: 0 } },
          requestId: 'test-request-id',
        });
      }),
    );

    renderPage();

    await screen.findByRole('heading', { name: 'My Auto' });

    const toggle = screen.getByRole('switch', { name: /disable automation/i });
    await user.click(toggle);

    // Disable confirmation dialog should appear
    expect(await screen.findByText('Disable Automation')).toBeInTheDocument();
    expect(screen.getByText(/are you sure you want to disable/i)).toBeInTheDocument();
  });

  it('should close disable dialog after confirming disable', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('/api/orgs/:orgId/automations/:automationId', () => {
        return HttpResponse.json({
          data: mockAutomationWithVariables({ id: 1, name: 'My Auto', enabled: true }),
          requestId: 'test-request-id',
        });
      }),
      http.get('/api/orgs/:orgId/executions', () => {
        return HttpResponse.json({
          data: { items: [], meta: { total: 0, limit: 5, offset: 0 } },
          requestId: 'test-request-id',
        });
      }),
    );

    renderPage();

    await screen.findByRole('heading', { name: 'My Auto' });

    await user.click(screen.getByRole('switch', { name: /disable automation/i }));
    await screen.findByText('Disable Automation');

    await user.click(screen.getByRole('button', { name: 'Disable' }));

    // Dialog should close after confirming
    await waitFor(() => {
      expect(screen.queryByText('Disable Automation')).not.toBeInTheDocument();
    });
  });

  it('should open delete dialog when clicking Delete button', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('/api/orgs/:orgId/executions', () => {
        return HttpResponse.json({
          data: { items: [], meta: { total: 0, limit: 5, offset: 0 } },
          requestId: 'test-request-id',
        });
      }),
    );

    renderPage();

    await screen.findByRole('heading', { name: 'Test Automation' });

    await user.click(screen.getByRole('button', { name: /delete/i }));

    expect(await screen.findByText('Delete Automation')).toBeInTheDocument();
  });

  it('should open trigger dialog when clicking Trigger button', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('/api/orgs/:orgId/executions', () => {
        return HttpResponse.json({
          data: { items: [], meta: { total: 0, limit: 5, offset: 0 } },
          requestId: 'test-request-id',
        });
      }),
    );

    renderPage();

    await screen.findByRole('heading', { name: 'Test Automation' });

    await user.click(screen.getByRole('button', { name: /trigger/i }));

    // Dialog title is "Trigger {automation.name}"
    expect(await screen.findByText('Trigger Test Automation')).toBeInTheDocument();
  });
});
