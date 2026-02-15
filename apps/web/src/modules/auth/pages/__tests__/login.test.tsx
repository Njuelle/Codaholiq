import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '@/test/test-utils';
import { LoginPage } from '../login';
import { mockUser } from '@/test/factories';

describe('LoginPage', () => {
  it('should render login button when not authenticated', () => {
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
      </Routes>,
      { initialRoute: '/login' },
    );

    expect(screen.getByText('Sign in with GitHub')).toBeInTheDocument();
    expect(screen.getByAltText('Codaholiq')).toBeInTheDocument();
  });

  it('should redirect to /orgs when already authenticated', () => {
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/orgs" element={<div>Org Page</div>} />
      </Routes>,
      { user: mockUser(), initialRoute: '/login' },
    );

    expect(screen.getByText('Org Page')).toBeInTheDocument();
    expect(screen.queryByText('Sign in with GitHub')).not.toBeInTheDocument();
  });
});
