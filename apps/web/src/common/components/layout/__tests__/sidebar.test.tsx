import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '@/test/test-utils';
import { mockUser, mockOrg } from '@/test/factories';
import { Sidebar } from '../sidebar';

describe('Sidebar', () => {
  const org = mockOrg({ id: 1, name: 'Test Org' });
  const user = mockUser();

  function renderSidebar(collapsed = false): ReturnType<typeof renderWithProviders> {
    const onToggle = vi.fn();
    return renderWithProviders(
      <Routes>
        <Route
          path="/orgs/:orgId/*"
          element={<Sidebar collapsed={collapsed} onToggleCollapse={onToggle} />}
        />
      </Routes>,
      { user, org, initialRoute: '/orgs/1/dashboard' },
    );
  }

  it('should render all navigation items', () => {
    renderSidebar();

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Repositories')).toBeInTheDocument();
    expect(screen.getByText('Automations')).toBeInTheDocument();
    expect(screen.getByText('Executions')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should render logo when expanded', () => {
    renderSidebar(false);
    expect(screen.getByAltText('Codaholiq')).toBeInTheDocument();
  });

  it('should hide labels when collapsed', () => {
    renderSidebar(true);
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('should have collapse toggle button', () => {
    renderSidebar(false);
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
  });

  it('should have expand toggle button when collapsed', () => {
    renderSidebar(true);
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
  });
});
