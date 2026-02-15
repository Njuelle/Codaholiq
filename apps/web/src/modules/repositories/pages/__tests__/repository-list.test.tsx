import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '@/test/test-utils';
import { mockOrg, mockRepo, mockUser } from '@/test/factories';
import { server } from '@/test/msw-server';
import { RepositoryListPage } from '../repository-list';

const testUser = mockUser({ id: 1, username: 'testuser' });
const testOrg = mockOrg({ id: 1, name: 'Test Org', slug: 'test-org' });

function renderPage(): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <Routes>
      <Route path="/orgs/:orgId/repos" element={<RepositoryListPage />} />
    </Routes>,
    { initialRoute: '/orgs/1/repos', user: testUser, org: testOrg },
  );
}

describe('RepositoryListPage', () => {
  it('should render page header', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Repositories' })).toBeInTheDocument();
    expect(screen.getByText('Manage your connected repositories.')).toBeInTheDocument();
  });

  it('should render repository table with data', async () => {
    server.use(
      http.get('/api/orgs/:orgId/repos', () => {
        return HttpResponse.json({
          data: {
            items: [
              mockRepo({
                id: 1,
                fullName: 'test-org/frontend',
                language: 'TypeScript',
              }),
              mockRepo({
                id: 2,
                fullName: 'test-org/api',
                language: 'Go',
              }),
            ],
            meta: { total: 2, limit: 20, offset: 0 },
          },
          requestId: 'test-request-id',
        });
      }),
    );

    renderPage();

    expect(await screen.findByText('test-org/frontend')).toBeInTheDocument();
    expect(screen.getByText('test-org/api')).toBeInTheDocument();
  });

  it('should show loading skeleton', () => {
    server.use(
      http.get('/api/orgs/:orgId/repos', () => {
        return new Promise(() => {});
      }),
    );

    renderPage();

    expect(screen.getByRole('heading', { name: 'Repositories' })).toBeInTheDocument();

    const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should show empty state when no repos', async () => {
    server.use(
      http.get('/api/orgs/:orgId/repos', () => {
        return HttpResponse.json({
          data: { items: [], meta: { total: 0, limit: 20, offset: 0 } },
          requestId: 'test-request-id',
        });
      }),
    );

    renderPage();

    expect(await screen.findByText('No repositories found')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Repositories will appear here once you install the GitHub App on your organization.',
      ),
    ).toBeInTheDocument();
  });

  it('should render sync button', async () => {
    renderPage();

    const syncButton = await screen.findByRole('button', {
      name: /sync repos/i,
    });
    expect(syncButton).toBeInTheDocument();
  });

  it('should render error state when fetch fails', async () => {
    server.use(
      http.get('/api/orgs/:orgId/repos', () => {
        return HttpResponse.json(
          {
            statusCode: 500,
            error: 'Internal Server Error',
            message: 'DB down',
          },
          { status: 500 },
        );
      }),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/failed to load repositories/i)).toBeInTheDocument();
    });
  });

  it('should render pagination when repos are loaded', async () => {
    renderPage();

    await screen.findByText('test-org/repo-1');

    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });

  it('should disable Previous button on the first page', async () => {
    renderPage();

    await screen.findByText('test-org/repo-1');

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });
});
