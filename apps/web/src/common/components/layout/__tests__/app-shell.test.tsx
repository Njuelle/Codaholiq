import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '@/test/test-utils';
import { mockUser, mockOrg } from '@/test/factories';
import { AppShell } from '../app-shell';

describe('AppShell', () => {
  it('should render sidebar, topbar, and outlet content', () => {
    renderWithProviders(
      <Routes>
        <Route path="/orgs/:orgId" element={<AppShell />}>
          <Route path="dashboard" element={<div>Dashboard Content</div>} />
        </Route>
      </Routes>,
      {
        user: mockUser(),
        org: mockOrg({ id: 1, name: 'My Org' }),
        initialRoute: '/orgs/1/dashboard',
      },
    );

    // Sidebar nav items
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Automations')).toBeInTheDocument();

    // TopBar elements
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();

    // Outlet content
    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  });
});
