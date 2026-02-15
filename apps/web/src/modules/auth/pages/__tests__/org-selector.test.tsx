import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '@/test/test-utils';
import { mockOrg, mockUser } from '@/test/factories';
import { server } from '@/test/msw-server';
import { OrgSelectorPage } from '../org-selector';

const testUser = mockUser({ id: 1, username: 'testuser' });

describe('OrgSelectorPage', () => {
  it('should render empty state when user has no orgs', async () => {
    server.use(
      http.get('/api/orgs', () => {
        return HttpResponse.json({ data: [], requestId: 'test' });
      }),
    );

    renderWithProviders(
      <Routes>
        <Route path="/orgs" element={<OrgSelectorPage />} />
      </Routes>,
      { initialRoute: '/orgs', user: testUser },
    );

    expect(await screen.findByText(/not a member of any organization/)).toBeInTheDocument();
  });

  it('should render org list when multiple orgs exist', async () => {
    server.use(
      http.get('/api/orgs', () => {
        return HttpResponse.json({
          data: [
            mockOrg({ id: 10, name: 'Org A', slug: 'org-a' }),
            mockOrg({ id: 20, name: 'Org B', slug: 'org-b' }),
          ],
          requestId: 'test',
        });
      }),
    );

    renderWithProviders(
      <Routes>
        <Route path="/orgs" element={<OrgSelectorPage />} />
        <Route path="/orgs/:orgId/dashboard" element={<div>Dashboard</div>} />
      </Routes>,
      { initialRoute: '/orgs', user: testUser },
    );

    expect(await screen.findByText('Org A')).toBeInTheDocument();
    expect(screen.getByText('Org B')).toBeInTheDocument();
  });

  it('should navigate to org dashboard on click', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('/api/orgs', () => {
        return HttpResponse.json({
          data: [
            mockOrg({ id: 10, name: 'Org A', slug: 'org-a' }),
            mockOrg({ id: 20, name: 'Org B', slug: 'org-b' }),
          ],
          requestId: 'test',
        });
      }),
    );

    renderWithProviders(
      <Routes>
        <Route path="/orgs" element={<OrgSelectorPage />} />
        <Route path="/orgs/:orgId/dashboard" element={<div>Dashboard</div>} />
      </Routes>,
      { initialRoute: '/orgs', user: testUser },
    );

    await user.click(await screen.findByText('Org A'));

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  it('should auto-redirect when only one org exists', async () => {
    server.use(
      http.get('/api/orgs', () => {
        return HttpResponse.json({
          data: [mockOrg({ id: 10, name: 'Only Org', slug: 'only' })],
          requestId: 'test',
        });
      }),
    );

    renderWithProviders(
      <Routes>
        <Route path="/orgs" element={<OrgSelectorPage />} />
        <Route path="/orgs/:orgId/dashboard" element={<div>Dashboard</div>} />
      </Routes>,
      { initialRoute: '/orgs', user: testUser },
    );

    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
  });
});
