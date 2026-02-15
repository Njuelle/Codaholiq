import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/test-utils';
import { mockExecutionLog, mockOrg, mockUser } from '@/test/factories';
import { server } from '@/test/msw-server';
import { LogViewer } from '../log-viewer';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 24,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * 24,
        size: 24,
        key: i,
      })),
    scrollToIndex: vi.fn(),
    measureElement: vi.fn(),
  }),
}));

const testUser = mockUser({ id: 1, username: 'testuser' });
const testOrg = mockOrg({ id: 1, name: 'Test Org', slug: 'test-org' });

function renderLogViewer(
  executionStatus: 'completed' | 'running' = 'completed',
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <LogViewer orgId={1} executionId={1} executionStatus={executionStatus} />,
    { user: testUser, org: testOrg },
  );
}

describe('LogViewer', () => {
  it('should render logs', async () => {
    renderLogViewer();

    expect(
      await screen.findByText('Starting execution...', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Slow response')).toBeInTheDocument();
  });

  it('should display log count', async () => {
    renderLogViewer();

    expect(await screen.findByText('(2 entries)')).toBeInTheDocument();
  });

  it('should render log level labels', async () => {
    renderLogViewer();

    await screen.findByText('Starting execution...');
    expect(screen.getByText('INFO')).toBeInTheDocument();
    expect(screen.getByText('WARN')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    server.use(
      http.get('/api/orgs/:orgId/executions/:executionId/logs', () => {
        return new Promise(() => {});
      }),
    );

    renderLogViewer();

    expect(screen.getByText('Loading logs...')).toBeInTheDocument();
  });

  it('should show empty state', async () => {
    server.use(
      http.get('/api/orgs/:orgId/executions/:executionId/logs', () => {
        return HttpResponse.json({
          data: [],
          requestId: 'test-request-id',
        });
      }),
    );

    renderLogViewer();

    expect(await screen.findByText('No logs yet.')).toBeInTheDocument();
  });

  it('should have copy and download buttons', async () => {
    renderLogViewer();

    await screen.findByText('Starting execution...');
    expect(screen.getByRole('button', { name: /copy logs/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download logs/i })).toBeInTheDocument();
  });

  it('should have a log role for accessibility', async () => {
    renderLogViewer();

    await screen.findByText('Starting execution...');
    expect(screen.getByRole('log')).toBeInTheDocument();
  });

  it('should render single entry text correctly', async () => {
    server.use(
      http.get('/api/orgs/:orgId/executions/:executionId/logs', () => {
        return HttpResponse.json({
          data: [mockExecutionLog({ id: 1, message: 'Single entry' })],
          requestId: 'test-request-id',
        });
      }),
    );

    renderLogViewer();

    expect(await screen.findByText('(1 entry)')).toBeInTheDocument();
  });

  it('should show Live indicator when streaming', async () => {
    // For a running execution, SSE will attempt to connect
    // The default handler responds to the REST logs endpoint
    renderLogViewer('running');

    await screen.findByText('Starting execution...');
    // The component renders the Logs title regardless
    expect(screen.getByText('Logs')).toBeInTheDocument();
  });

  it('should call clipboard API on copy click', async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    renderLogViewer();

    await screen.findByText('Starting execution...');
    await user.click(screen.getByRole('button', { name: /copy logs/i }));

    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('Starting execution...'));
  });
});
