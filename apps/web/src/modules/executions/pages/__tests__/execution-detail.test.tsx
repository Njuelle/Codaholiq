import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '@/test/test-utils';
import { mockExecution, mockOrg, mockUser } from '@/test/factories';
import { server } from '@/test/msw-server';
import { ExecutionDetailPage } from '../execution-detail';

const testUser = mockUser({ id: 1, username: 'testuser' });
const testOrg = mockOrg({ id: 1, name: 'Test Org', slug: 'test-org' });

function renderPage(): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <Routes>
      <Route path="/orgs/:orgId/executions/:executionId" element={<ExecutionDetailPage />} />
    </Routes>,
    {
      initialRoute: '/orgs/1/executions/1',
      user: testUser,
      org: testOrg,
    },
  );
}

describe('ExecutionDetailPage', () => {
  it('should render execution detail', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: /execution #1/i })).toBeInTheDocument();
    const automationElements = screen.getAllByText('Test Automation');
    expect(automationElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should render execution info card', async () => {
    renderPage();

    expect(await screen.findByText('Execution Info')).toBeInTheDocument();
    const completedElements = screen.getAllByText('Completed');
    expect(completedElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should render resolved prompt', async () => {
    renderPage();

    expect(await screen.findByText('Resolved Prompt')).toBeInTheDocument();
    expect(screen.getByText('Fix the issue in src/main.ts')).toBeInTheDocument();
  });

  it('should show Cancel button for running execution', async () => {
    server.use(
      http.get('/api/orgs/:orgId/executions/:executionId', () => {
        return HttpResponse.json({
          data: {
            execution: mockExecution({
              id: 1,
              status: 'running',
              completedAt: null,
            }),
            automationName: 'Running Bot',
          },
          requestId: 'test-request-id',
        });
      }),
    );

    renderPage();

    expect(await screen.findByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('should show Retry button for failed execution', async () => {
    server.use(
      http.get('/api/orgs/:orgId/executions/:executionId', () => {
        return HttpResponse.json({
          data: {
            execution: mockExecution({
              id: 1,
              status: 'failed',
              errorMessage: 'Timeout',
            }),
            automationName: 'Failed Bot',
          },
          requestId: 'test-request-id',
        });
      }),
    );

    renderPage();

    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('should render error state', async () => {
    server.use(
      http.get('/api/orgs/:orgId/executions/:executionId', () => {
        return HttpResponse.json(
          { statusCode: 404, error: 'Not Found', message: 'Not found' },
          { status: 404 },
        );
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/not found/i)).toBeInTheDocument();
    });
  });

  it('should render loading skeleton', () => {
    server.use(
      http.get('/api/orgs/:orgId/executions/:executionId', () => {
        return new Promise(() => {});
      }),
    );

    renderPage();

    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
