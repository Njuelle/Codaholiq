import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/test-utils';
import { mockUser, mockOrg, mockAllRolePermissions } from '@/test/factories';
import { Permission } from '@/common/types';
import { PermissionsTable } from '../permissions-table';

const org = mockOrg({ id: 1, name: 'Test Org' });
const user = mockUser({ username: 'alice' });

function renderTable(): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <Routes>
      <Route path="/orgs/:orgId/*" element={<PermissionsTable orgId={1} />} />
    </Routes>,
    { user, org, initialRoute: '/orgs/1/settings' },
  );
}

describe('PermissionsTable', () => {
  it('should render permission groups and checkboxes', async () => {
    renderTable();

    await waitFor(() => {
      expect(screen.getByText('Role Permissions')).toBeInTheDocument();
    });

    expect(screen.getByText('Automations')).toBeInTheDocument();
    expect(screen.getByText('Executions')).toBeInTheDocument();
    expect(screen.getByText('Organization')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('should show owner checkboxes as disabled', async () => {
    renderTable();

    await waitFor(() => {
      expect(screen.getByText('Role Permissions')).toBeInTheDocument();
    });

    const ownerCheckboxes = screen.getAllByRole('checkbox', { name: /^Owner:/ });
    for (const checkbox of ownerCheckboxes) {
      expect(checkbox).toBeDisabled();
    }
  });

  it('should reflect fetched permissions', async () => {
    server.use(
      http.get('/api/orgs/:orgId/permissions', () => {
        return HttpResponse.json({
          data: mockAllRolePermissions({
            admin: [Permission.AUTOMATIONS_VIEW],
            member: [],
          }),
          requestId: 'test-request-id',
        });
      }),
    );

    renderTable();

    await waitFor(() => {
      expect(screen.getByText('Role Permissions')).toBeInTheDocument();
    });

    // Admin: Automations View should be checked
    const adminViewCheckbox = screen.getByRole('checkbox', { name: 'Admin: Automations View' });
    expect(adminViewCheckbox).toBeChecked();

    // Admin: Automations Create should not be checked
    const adminCreateCheckbox = screen.getByRole('checkbox', { name: 'Admin: Automations Create' });
    expect(adminCreateCheckbox).not.toBeChecked();
  });

  it('should enable save button when a checkbox is toggled', async () => {
    renderTable();

    await waitFor(() => {
      expect(screen.getByText('Role Permissions')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /Save Permissions/i });
    expect(saveButton).toBeDisabled();

    const user2 = userEvent.setup();
    const memberCreateCheckbox = screen.getByRole('checkbox', {
      name: 'Member: Automations Create',
    });
    await user2.click(memberCreateCheckbox);

    expect(saveButton).toBeEnabled();
  });

  it('should call PUT endpoint on save', async () => {
    let putCalls = 0;
    server.use(
      http.put('/api/orgs/:orgId/permissions/:role', () => {
        putCalls++;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderTable();

    await waitFor(() => {
      expect(screen.getByText('Role Permissions')).toBeInTheDocument();
    });

    const user2 = userEvent.setup();
    const memberCreateCheckbox = screen.getByRole('checkbox', {
      name: 'Member: Automations Create',
    });
    await user2.click(memberCreateCheckbox);

    const saveButton = screen.getByRole('button', { name: /Save Permissions/i });
    await user2.click(saveButton);

    await waitFor(() => {
      // Should call PUT twice: once for admin, once for member
      expect(putCalls).toBe(2);
    });
  });
});
