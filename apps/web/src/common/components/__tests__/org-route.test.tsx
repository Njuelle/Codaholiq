import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/modules/auth/hooks/use-auth';
import { OrgProvider } from '@/modules/organizations/hooks/use-org';
import { ThemeProvider } from '@/common/hooks/use-theme';
import { OrgRoute } from '../org-route';
import { mockOrg, mockUser } from '@/test/factories';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import type { ReactNode } from 'react';

function renderWithOrgRoute({
  initialRoute,
  orgs,
}: {
  initialRoute: string;
  orgs: ReturnType<typeof mockOrg>[];
}): ReturnType<typeof render> {
  server.use(
    http.get('/api/orgs', () => {
      return HttpResponse.json({ data: orgs, requestId: 'req-1' });
    }),
  );

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  function Wrapper({ children }: { children: ReactNode }): ReactNode {
    return (
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider initialUser={mockUser()} initialIsAuthenticated>
            <OrgProvider>
              <MemoryRouter initialEntries={[initialRoute]}>{children}</MemoryRouter>
            </OrgProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    );
  }

  return render(
    <Routes>
      <Route path="/orgs/:orgId" element={<OrgRoute />}>
        <Route path="dashboard" element={<div>Dashboard Content</div>} />
      </Route>
      <Route path="/forbidden" element={<div>Forbidden Page</div>} />
    </Routes>,
    { wrapper: Wrapper },
  );
}

describe('OrgRoute', () => {
  it('should render outlet when org is valid', async () => {
    const org = mockOrg({ id: 1 });
    renderWithOrgRoute({
      initialRoute: '/orgs/1/dashboard',
      orgs: [org],
    });

    expect(await screen.findByText('Dashboard Content')).toBeInTheDocument();
  });

  it('should redirect to forbidden when org does not exist', async () => {
    renderWithOrgRoute({
      initialRoute: '/orgs/999/dashboard',
      orgs: [mockOrg({ id: 1 })],
    });

    expect(await screen.findByText('Forbidden Page')).toBeInTheDocument();
  });
});
