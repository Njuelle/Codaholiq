import { render, screen } from '@testing-library/react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { renderWithProviders } from '@/test/test-utils';
import { LoginPage } from '@/modules/auth/pages/login';
import { ProtectedRoute } from '@/common/components/protected-route';
import App from './App';

describe('App', () => {
  it('should redirect unauthenticated users to login', () => {
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Navigate to="/orgs" replace />} />
        </Route>
      </Routes>,
      { initialRoute: '/' },
    );

    expect(screen.getByText('Sign in with GitHub')).toBeInTheDocument();
  });

  it('should render the App component with all providers', async () => {
    render(<App />);

    // App mounts → AuthProvider tries session restore → fails (invalid JWT)
    // → ProtectedRoute redirects to /login → lazy LoginPage loads
    expect(
      await screen.findByText('Sign in with GitHub', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
  });
});
