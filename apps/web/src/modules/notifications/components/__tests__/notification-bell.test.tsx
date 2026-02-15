import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/test-utils';
import { mockUser, mockOrg, mockNotification } from '@/test/factories';
import { NotificationBell } from '../notification-bell';

const org = mockOrg({ id: 1, name: 'Test Org' });
const user = mockUser({ username: 'alice' });

function renderBell(): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <Routes>
      <Route path="/orgs/:orgId/*" element={<NotificationBell />} />
    </Routes>,
    { user, org, initialRoute: '/orgs/1/dashboard' },
  );
}

describe('NotificationBell', () => {
  it('should render bell button', () => {
    renderBell();
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('should not show badge when no notifications', async () => {
    renderBell();

    await waitFor(() => {
      // Default MSW handler returns empty array — no badge visible
      const button = screen.getByRole('button', { name: 'Notifications' });
      expect(button.querySelector('span')).toBeNull();
    });
  });

  it('should show badge with count when notifications exist', async () => {
    server.use(
      http.get('/api/orgs/:orgId/notifications', () => {
        return HttpResponse.json({
          data: [
            mockNotification({ id: 1 }),
            mockNotification({ id: 2 }),
            mockNotification({ id: 3 }),
          ],
          requestId: 'test-request-id',
        });
      }),
    );

    renderBell();

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('should show "No notifications" in popover when empty', async () => {
    const user2 = userEvent.setup();
    renderBell();

    await user2.click(screen.getByRole('button', { name: 'Notifications' }));

    await waitFor(() => {
      expect(screen.getByText('No notifications')).toBeInTheDocument();
    });
  });

  it('should show notification list in popover', async () => {
    server.use(
      http.get('/api/orgs/:orgId/notifications', () => {
        return HttpResponse.json({
          data: [
            mockNotification({
              id: 1,
              automationName: 'Deploy Bot',
              message: 'Execution #1 of "Deploy Bot" failed',
            }),
          ],
          requestId: 'test-request-id',
        });
      }),
    );

    const user2 = userEvent.setup();
    renderBell();

    await user2.click(screen.getByRole('button', { name: 'Notifications' }));

    await waitFor(() => {
      expect(screen.getByText('Deploy Bot')).toBeInTheDocument();
      expect(screen.getByText('Execution #1 of "Deploy Bot" failed')).toBeInTheDocument();
    });
  });

  it('should navigate to execution on notification click', async () => {
    server.use(
      http.get('/api/orgs/:orgId/notifications', () => {
        return HttpResponse.json({
          data: [
            mockNotification({
              id: 1,
              executionId: 42,
              automationName: 'Lint',
              message: 'Execution #42 of "Lint" failed',
            }),
          ],
          requestId: 'test-request-id',
        });
      }),
    );

    const user2 = userEvent.setup();

    // Render with an outlet to capture navigation
    renderWithProviders(
      <Routes>
        <Route path="/orgs/:orgId/*" element={<NotificationBell />} />
        <Route
          path="/orgs/:orgId/executions/:executionId"
          element={<div data-testid="execution-detail" />}
        />
      </Routes>,
      { user, org, initialRoute: '/orgs/1/dashboard' },
    );

    await user2.click(screen.getByRole('button', { name: 'Notifications' }));

    await waitFor(() => {
      expect(screen.getByText('Lint')).toBeInTheDocument();
    });

    await user2.click(screen.getByText('Lint'));

    await waitFor(() => {
      expect(screen.getByTestId('execution-detail')).toBeInTheDocument();
    });
  });
});
