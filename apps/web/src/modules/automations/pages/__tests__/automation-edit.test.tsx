import { render, screen, waitFor, type RenderResult } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/modules/auth/hooks/use-auth';
import { OrgProvider } from '@/modules/organizations/hooks/use-org';
import { mockAutomationWithVariables, mockOrg, mockUser } from '@/test/factories';
import { server } from '@/test/msw-server';
import { AutomationEditPage } from '../automation-edit';
import type { ReactElement, ReactNode } from 'react';

const testUser = mockUser({ id: 1, username: 'testuser' });
const testOrg = mockOrg({ id: 1, name: 'Test Org', slug: 'test-org' });

/**
 * AutomationEditPage uses `useBlocker` which requires a data router.
 * We use `createMemoryRouter` + `RouterProvider` instead of `MemoryRouter`.
 */
function renderPage(): RenderResult {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  const router = createMemoryRouter(
    [
      {
        path: '/orgs/:orgId/automations/:automationId/edit',
        element: <AutomationEditPage />,
      },
    ],
    { initialEntries: ['/orgs/1/automations/1/edit'] },
  );

  function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={testUser} initialIsAuthenticated>
          <OrgProvider initialOrg={testOrg}>{children}</OrgProvider>
        </AuthProvider>
      </QueryClientProvider>
    );
  }

  return render(<RouterProvider router={router} />, { wrapper: Wrapper });
}

describe('AutomationEditPage', () => {
  it('should render the "Edit Automation" heading', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Edit Automation' })).toBeInTheDocument();
  });

  it('should render loading skeleton initially', () => {
    server.use(
      http.get('/api/orgs/:orgId/automations/:automationId', () => {
        return new Promise(() => {});
      }),
    );

    renderPage();

    expect(screen.getByRole('heading', { name: 'Edit Automation' })).toBeInTheDocument();

    // Skeleton elements should be present during loading
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render form with automation data after loading', async () => {
    server.use(
      http.get('/api/orgs/:orgId/automations/:automationId', () => {
        return HttpResponse.json({
          data: mockAutomationWithVariables({
            id: 1,
            name: 'My Test Automation',
            description: 'Does things automatically',
            triggerType: 'event',
            triggerConfig: { events: ['push'] },
            promptTemplate: 'Fix the bug in {{file}}',
            workflowFile: '.github/workflows/codaholiq.yml',
            enabled: true,
          }),
          requestId: 'test-request-id',
        });
      }),
    );

    renderPage();

    // Wait for the form to render with the automation name populated
    const nameInput = await screen.findByLabelText('Name');
    expect(nameInput).toHaveValue('My Test Automation');
  });

  it('should render tabs for form sections', async () => {
    renderPage();

    // Wait for data to load
    await screen.findByLabelText('Name');

    expect(screen.getByRole('tab', { name: 'Basics' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Trigger' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Prompt' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Workflow' })).toBeInTheDocument();
  });

  it('should render a Back link to the automation detail page', async () => {
    renderPage();

    const backLink = await screen.findByRole('link', { name: /back/i });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute('href', '/orgs/1/automations/1');
  });

  it('should render error state when fetch fails', async () => {
    server.use(
      http.get('/api/orgs/:orgId/automations/:automationId', () => {
        return HttpResponse.json(
          {
            statusCode: 500,
            error: 'Internal Server Error',
            message: 'Database connection lost',
          },
          { status: 500 },
        );
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/failed to load automation/i)).toBeInTheDocument();
    });
  });

  it('should show the automation name as page description after loading', async () => {
    renderPage();

    // Default MSW handler returns automation with name "Test Automation"
    expect(await screen.findByText('Test Automation')).toBeInTheDocument();
  });
});
