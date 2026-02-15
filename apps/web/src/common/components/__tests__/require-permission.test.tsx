import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/test-utils';
import { mockUser, mockOrg, mockMyPermissionsResponse } from '@/test/factories';
import { Permission } from '@/common/types';
import { RequirePermission } from '../require-permission';

const org = mockOrg({ id: 1, name: 'Test Org' });
const user = mockUser({ username: 'alice' });

function renderWithPermission({
  permission,
  permissions,
  role = 'member',
}: {
  permission: Permission;
  permissions: Permission[];
  role?: 'owner' | 'admin' | 'member';
}): ReturnType<typeof renderWithProviders> {
  server.use(
    http.get('/api/orgs/:orgId/permissions/me', () => {
      return HttpResponse.json({
        data: mockMyPermissionsResponse({ role, permissions }),
        requestId: 'test-request-id',
      });
    }),
  );

  return renderWithProviders(
    <Routes>
      <Route
        path="/orgs/:orgId/*"
        element={
          <RequirePermission orgId={1} permission={permission} fallback={<div>No access</div>}>
            <div>Protected content</div>
          </RequirePermission>
        }
      />
    </Routes>,
    { user, org, initialRoute: '/orgs/1/dashboard' },
  );
}

describe('RequirePermission', () => {
  it('should render children when user has the permission', async () => {
    renderWithPermission({
      permission: Permission.AUTOMATIONS_VIEW,
      permissions: [Permission.AUTOMATIONS_VIEW, Permission.EXECUTIONS_VIEW],
    });

    await waitFor(() => {
      expect(screen.getByText('Protected content')).toBeInTheDocument();
    });
  });

  it('should render fallback when user lacks the permission', async () => {
    renderWithPermission({
      permission: Permission.AUTOMATIONS_CREATE,
      permissions: [Permission.AUTOMATIONS_VIEW],
    });

    await waitFor(() => {
      expect(screen.getByText('No access')).toBeInTheDocument();
    });

    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('should render nothing when no fallback and user lacks permission', async () => {
    server.use(
      http.get('/api/orgs/:orgId/permissions/me', () => {
        return HttpResponse.json({
          data: mockMyPermissionsResponse({
            role: 'member',
            permissions: [],
          }),
          requestId: 'test-request-id',
        });
      }),
    );

    const { container } = renderWithProviders(
      <Routes>
        <Route
          path="/orgs/:orgId/*"
          element={
            <RequirePermission orgId={1} permission={Permission.AUTOMATIONS_CREATE}>
              <div>Protected content</div>
            </RequirePermission>
          }
        />
      </Routes>,
      { user, org, initialRoute: '/orgs/1/dashboard' },
    );

    await waitFor(() => {
      expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    });

    // The container should only have the router wrapper with no visible content
    expect(container.textContent).toBe('');
  });

  it('should render children for owner with all permissions', async () => {
    renderWithPermission({
      permission: Permission.ORG_MEMBERS_MANAGE,
      permissions: Object.values(Permission),
      role: 'owner',
    });

    await waitFor(() => {
      expect(screen.getByText('Protected content')).toBeInTheDocument();
    });
  });
});
