import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/test-utils';
import { AuthCallbackPage } from '../auth-callback';

function createTestJwt({
  sub = 1,
  username = 'testuser',
  avatarUrl = null as string | null,
} = {}): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sub,
      username,
      avatarUrl,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900,
    }),
  );
  return `${header}.${payload}.test-sig`;
}

describe('AuthCallbackPage', () => {
  afterEach(() => {
    window.history.replaceState({}, '', window.location.pathname);
  });

  it('should exchange code and redirect to /orgs', async () => {
    const token = createTestJwt();
    server.use(
      http.post('/api/auth/exchange', () => {
        return HttpResponse.json({
          data: { accessToken: token },
          requestId: 'test-request-id',
        });
      }),
    );

    // Set query param before rendering
    window.history.pushState({}, '', '/auth/callback?code=test-code');

    renderWithProviders(
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/orgs" element={<div>Orgs Page</div>} />
      </Routes>,
      {
        initialRoute: '/auth/callback',
      },
    );

    expect(await screen.findByText('Orgs Page')).toBeInTheDocument();
  });

  it('should redirect to /login when code is missing', async () => {
    window.history.pushState({}, '', '/auth/callback');

    renderWithProviders(
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>,
      { initialRoute: '/auth/callback' },
    );

    expect(await screen.findByText('Login Page')).toBeInTheDocument();
  });

  it('should redirect to /login when exchange fails', async () => {
    server.use(
      http.post('/api/auth/exchange', () => {
        return HttpResponse.json(
          { statusCode: 401, error: 'Unauthorized', message: 'Invalid code' },
          { status: 401 },
        );
      }),
      // Also mock refresh to fail so the 401 interceptor doesn't retry successfully
      http.post('/api/auth/refresh', () => {
        return HttpResponse.json(
          { statusCode: 401, error: 'Unauthorized', message: 'No session' },
          { status: 401 },
        );
      }),
    );

    window.history.pushState({}, '', '/auth/callback?code=bad-code');

    renderWithProviders(
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>,
      { initialRoute: '/auth/callback' },
    );

    expect(await screen.findByText('Login Page')).toBeInTheDocument();
  });
});
