import { screen } from '@testing-library/react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { renderWithProviders } from '@/test/test-utils';
import { LoginPage } from '@/modules/auth/pages/login';
import { ProtectedRoute } from '@/common/components/protected-route';

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
});
