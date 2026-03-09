import { lazy } from 'react';
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { createQueryClient } from '@/common/lib/query-client';
import { ThemeProvider, useTheme } from '@/common/hooks/use-theme';
import { AuthProvider } from '@/modules/auth/hooks/use-auth';
import { OrgProvider } from '@/modules/organizations/hooks/use-org';
import { ProtectedRoute } from '@/common/components/protected-route';
import { OrgRoute } from '@/common/components/org-route';
import { ErrorBoundary } from '@/common/components/error-boundary';
import { RouteErrorBoundary } from '@/common/components/route-error-boundary';
import { PageSuspense } from '@/common/components/page-suspense';
import { NotFoundPage } from '@/common/pages/not-found';
import { ForbiddenPage } from '@/common/pages/forbidden';
import type { ReactElement } from 'react';

// Lazy-loaded page components (code-split per route)
const LoginPage = lazy(() =>
  import('@/modules/auth/pages/login').then((m) => ({ default: m.LoginPage })),
);
const AuthCallbackPage = lazy(() =>
  import('@/modules/auth/pages/auth-callback').then((m) => ({ default: m.AuthCallbackPage })),
);
const OrgSelectorPage = lazy(() =>
  import('@/modules/auth/pages/org-selector').then((m) => ({ default: m.OrgSelectorPage })),
);
const DashboardPage = lazy(() =>
  import('@/modules/dashboard/pages/dashboard').then((m) => ({ default: m.DashboardPage })),
);
const AutomationsListPage = lazy(() =>
  import('@/modules/automations/pages/automations-list').then((m) => ({
    default: m.AutomationsListPage,
  })),
);
const AutomationNewPage = lazy(() =>
  import('@/modules/automations/pages/automation-new').then((m) => ({
    default: m.AutomationNewPage,
  })),
);
const AutomationCreatePage = lazy(() =>
  import('@/modules/automations/pages/automation-create').then((m) => ({
    default: m.AutomationCreatePage,
  })),
);
const AutomationDetailPage = lazy(() =>
  import('@/modules/automations/pages/automation-detail').then((m) => ({
    default: m.AutomationDetailPage,
  })),
);
const AutomationEditPage = lazy(() =>
  import('@/modules/automations/pages/automation-edit').then((m) => ({
    default: m.AutomationEditPage,
  })),
);
const ExecutionsListPage = lazy(() =>
  import('@/modules/executions/pages/executions-list').then((m) => ({
    default: m.ExecutionsListPage,
  })),
);
const ExecutionDetailPage = lazy(() =>
  import('@/modules/executions/pages/execution-detail').then((m) => ({
    default: m.ExecutionDetailPage,
  })),
);
const RepositoryListPage = lazy(() =>
  import('@/modules/repositories/pages/repository-list').then((m) => ({
    default: m.RepositoryListPage,
  })),
);
const RepositoryDetailPage = lazy(() =>
  import('@/modules/repositories/pages/repository-detail').then((m) => ({
    default: m.RepositoryDetailPage,
  })),
);
const AnalyticsPage = lazy(() =>
  import('@/modules/analytics/pages/analytics').then((m) => ({
    default: m.AnalyticsPage,
  })),
);
const OrgSettingsPage = lazy(() =>
  import('@/modules/organizations/pages/org-settings').then((m) => ({
    default: m.OrgSettingsPage,
  })),
);

const queryClient = createQueryClient();

function ThemedToaster(): ReactElement {
  const { resolvedTheme } = useTheme();
  return <Toaster position="bottom-right" richColors closeButton theme={resolvedTheme} />;
}

function RootLayout(): ReactElement {
  return (
    <ErrorBoundary>
      <Outlet />
    </ErrorBoundary>
  );
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      /* Public routes */
      {
        path: '/login',
        element: (
          <PageSuspense>
            <LoginPage />
          </PageSuspense>
        ),
      },
      {
        path: '/auth/callback',
        element: (
          <PageSuspense>
            <AuthCallbackPage />
          </PageSuspense>
        ),
      },

      /* Protected routes */
      {
        element: <ProtectedRoute />,
        children: [
          { path: '/', element: <Navigate to="/orgs" replace /> },
          {
            path: '/orgs',
            element: (
              <PageSuspense>
                <OrgSelectorPage />
              </PageSuspense>
            ),
          },

          /* Org-scoped routes */
          {
            path: '/orgs/:orgId',
            element: <OrgRoute />,
            children: [
              { index: true, element: <Navigate to="dashboard" replace /> },
              {
                path: 'dashboard',
                element: (
                  <RouteErrorBoundary>
                    <PageSuspense>
                      <DashboardPage />
                    </PageSuspense>
                  </RouteErrorBoundary>
                ),
              },
              {
                path: 'repos',
                element: (
                  <RouteErrorBoundary>
                    <PageSuspense>
                      <RepositoryListPage />
                    </PageSuspense>
                  </RouteErrorBoundary>
                ),
              },
              {
                path: 'repos/:repoId',
                element: (
                  <RouteErrorBoundary>
                    <PageSuspense>
                      <RepositoryDetailPage />
                    </PageSuspense>
                  </RouteErrorBoundary>
                ),
              },
              {
                path: 'automations',
                element: (
                  <RouteErrorBoundary>
                    <PageSuspense>
                      <AutomationsListPage />
                    </PageSuspense>
                  </RouteErrorBoundary>
                ),
              },
              {
                path: 'automations/new',
                element: (
                  <RouteErrorBoundary>
                    <PageSuspense>
                      <AutomationNewPage />
                    </PageSuspense>
                  </RouteErrorBoundary>
                ),
              },
              {
                path: 'automations/new/custom',
                element: (
                  <RouteErrorBoundary>
                    <PageSuspense>
                      <AutomationCreatePage />
                    </PageSuspense>
                  </RouteErrorBoundary>
                ),
              },
              {
                path: 'automations/:automationId/edit',
                element: (
                  <RouteErrorBoundary>
                    <PageSuspense>
                      <AutomationEditPage />
                    </PageSuspense>
                  </RouteErrorBoundary>
                ),
              },
              {
                path: 'automations/:automationId',
                element: (
                  <RouteErrorBoundary>
                    <PageSuspense>
                      <AutomationDetailPage />
                    </PageSuspense>
                  </RouteErrorBoundary>
                ),
              },
              {
                path: 'executions',
                element: (
                  <RouteErrorBoundary>
                    <PageSuspense>
                      <ExecutionsListPage />
                    </PageSuspense>
                  </RouteErrorBoundary>
                ),
              },
              {
                path: 'executions/:executionId',
                element: (
                  <RouteErrorBoundary>
                    <PageSuspense>
                      <ExecutionDetailPage />
                    </PageSuspense>
                  </RouteErrorBoundary>
                ),
              },
              {
                path: 'analytics',
                element: (
                  <RouteErrorBoundary>
                    <PageSuspense>
                      <AnalyticsPage />
                    </PageSuspense>
                  </RouteErrorBoundary>
                ),
              },
              {
                path: 'settings',
                element: (
                  <RouteErrorBoundary>
                    <PageSuspense>
                      <OrgSettingsPage />
                    </PageSuspense>
                  </RouteErrorBoundary>
                ),
              },
            ],
          },
        ],
      },

      /* Error routes */
      { path: '/forbidden', element: <ForbiddenPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default function App(): ReactElement {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <OrgProvider>
            <RouterProvider router={router} />
            <ThemedToaster />
          </OrgProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
