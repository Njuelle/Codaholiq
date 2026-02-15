import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '@/test/test-utils';
import { mockUser, mockOrg } from '@/test/factories';
import { TopBar } from '../top-bar';

describe('TopBar', () => {
  const org = mockOrg({ id: 1, name: 'Test Org' });
  const user = mockUser({ username: 'alice' });

  function renderTopBar(): ReturnType<typeof renderWithProviders> {
    return renderWithProviders(
      <Routes>
        <Route path="/orgs/:orgId/*" element={<TopBar />} />
      </Routes>,
      { user, org, initialRoute: '/orgs/1/dashboard' },
    );
  }

  it('should render org switcher', () => {
    renderTopBar();
    expect(screen.getByRole('combobox', { name: 'Switch organization' })).toBeInTheDocument();
  });

  it('should render notifications button', () => {
    renderTopBar();
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('should render theme toggle button', () => {
    renderTopBar();
    expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
  });

  it('should render user menu button', () => {
    renderTopBar();
    expect(screen.getByRole('button', { name: 'User menu' })).toBeInTheDocument();
  });

  it('should show user info in dropdown', async () => {
    const userEvent2 = userEvent.setup();
    renderTopBar();

    await userEvent2.click(screen.getByRole('button', { name: 'User menu' }));

    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('Sign out')).toBeInTheDocument();
  });
});
