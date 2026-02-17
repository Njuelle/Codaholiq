import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '@/test/test-utils';
import { mockOrg, mockUser } from '@/test/factories';
import { server } from '@/test/msw-server';
import { AutomationNewPage } from '../automation-new';

const testUser = mockUser({ id: 1, username: 'testuser' });
const testOrg = mockOrg({ id: 1, name: 'Test Org', slug: 'test-org' });

function renderPage(): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <Routes>
      <Route path="/orgs/:orgId/automations/new" element={<AutomationNewPage />} />
      <Route path="/orgs/:orgId/automations/new/custom" element={<div>Custom Form</div>} />
      <Route path="/orgs/:orgId/automations/:automationId" element={<div>Detail Page</div>} />
    </Routes>,
    { initialRoute: '/orgs/1/automations/new', user: testUser, org: testOrg },
  );
}

describe('AutomationNewPage', () => {
  it('should render the page heading', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'New Automation' }),
    ).toBeInTheDocument();
  });

  it('should render catalog category names with template counts', async () => {
    renderPage();

    expect(await screen.findByText('Code Quality')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
  });

  it('should have categories collapsed by default', async () => {
    renderPage();

    await screen.findByText('Code Quality');

    expect(screen.queryByText('PR Code Review')).not.toBeInTheDocument();
    expect(screen.queryByText('PR Security Scan')).not.toBeInTheDocument();
  });

  it('should expand category and show template cards when clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    const categoryTrigger = await screen.findByText('Code Quality');
    await user.click(categoryTrigger);

    expect(await screen.findByText('PR Code Review')).toBeInTheDocument();
  });

  it('should render the custom automation card', async () => {
    renderPage();

    expect(await screen.findByText('Custom Automation')).toBeInTheDocument();
  });

  it('should link custom card to /new/custom', async () => {
    renderPage();

    const customLink = await screen.findByRole('link', { name: /custom automation/i });
    expect(customLink).toHaveAttribute('href', '/orgs/1/automations/new/custom');
  });

  it('should open repo select dialog when template card is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    // Expand category first
    const categoryTrigger = await screen.findByText('Code Quality');
    await user.click(categoryTrigger);

    const templateCard = await screen.findByText('PR Code Review');
    await user.click(templateCard);

    expect(await screen.findByText('Select a Repository')).toBeInTheDocument();
  });

  it('should show loading skeleton while fetching catalog', async () => {
    server.use(
      http.get('/api/automation-catalog', () => {
        return new Promise(() => {
          // Never resolves — simulates loading
        });
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Code Quality')).not.toBeInTheDocument();
    });
  });

  it('should close dialog when cancel is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    // Expand category first
    const categoryTrigger = await screen.findByText('Code Quality');
    await user.click(categoryTrigger);

    const templateCard = await screen.findByText('PR Code Review');
    await user.click(templateCard);

    expect(await screen.findByText('Select a Repository')).toBeInTheDocument();

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText('Select a Repository')).not.toBeInTheDocument();
    });
  });
});
