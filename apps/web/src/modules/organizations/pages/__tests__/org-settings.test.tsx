import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '@/test/test-utils';
import { mockOrgMember, mockOrg, mockUser } from '@/test/factories';
import { server } from '@/test/msw-server';
import { OrgSettingsPage } from '../org-settings';

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const testUser = mockUser({ id: 1, username: 'testuser' });
const testOrg = mockOrg({ id: 1, name: 'Test Org', slug: 'test-org' });

function renderPage(): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <Routes>
      <Route path="/orgs/:orgId/settings" element={<OrgSettingsPage />} />
    </Routes>,
    { initialRoute: '/orgs/1/settings', user: testUser, org: testOrg },
  );
}

describe('OrgSettingsPage', () => {
  it('should render settings page with tabs', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();

    expect(screen.getByRole('tab', { name: 'Variables' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Members' })).toBeInTheDocument();
  });

  it('should render Variables tab as default', async () => {
    renderPage();

    const variablesTab = await screen.findByRole('tab', { name: 'Variables' });
    expect(variablesTab).toHaveAttribute('aria-selected', 'true');
  });

  it('should switch to Members tab', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('/api/orgs/:orgId/members', () => {
        return HttpResponse.json({
          data: [
            mockOrgMember({ userId: 1, username: 'owner-user', role: 'owner' }),
            mockOrgMember({ userId: 2, username: 'member-user', role: 'member' }),
          ],
          requestId: 'test-request-id',
        });
      }),
    );

    renderPage();

    await screen.findByRole('heading', { name: 'Settings' });

    const membersTab = screen.getByRole('tab', { name: 'Members' });
    await user.click(membersTab);

    expect(await screen.findByText('owner-user')).toBeInTheDocument();
    expect(screen.getByText('member-user')).toBeInTheDocument();
  });

  it('should show loading skeleton when org is not loaded', () => {
    renderWithProviders(
      <Routes>
        <Route path="/orgs/:orgId/settings" element={<OrgSettingsPage />} />
      </Routes>,
      { initialRoute: '/orgs/1/settings', user: testUser, org: null },
    );

    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should show error state when members fail to load', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('/api/orgs/:orgId/members', () => {
        return HttpResponse.json(
          { statusCode: 500, error: 'Internal Server Error', message: 'DB down' },
          { status: 500 },
        );
      }),
    );

    renderPage();

    await screen.findByRole('heading', { name: 'Settings' });

    const membersTab = screen.getByRole('tab', { name: 'Members' });
    await user.click(membersTab);

    await waitFor(() => {
      expect(screen.getByText(/failed to load members/i)).toBeInTheDocument();
    });
  });
});
