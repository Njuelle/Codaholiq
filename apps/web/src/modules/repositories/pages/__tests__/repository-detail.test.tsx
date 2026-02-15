import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '@/test/test-utils';
import { mockUser, mockOrg } from '@/test/factories';
import { server } from '@/test/msw-server';
import { RepositoryDetailPage } from '../repository-detail';

const testUser = mockUser({ id: 1, username: 'testuser' });
const testOrg = mockOrg({ id: 1, name: 'Test Org', slug: 'test-org' });

function renderPage({ repoId = '1' }: { repoId?: string } = {}): ReturnType<
  typeof renderWithProviders
> {
  return renderWithProviders(
    <Routes>
      <Route path="/orgs/:orgId/repos/:repoId" element={<RepositoryDetailPage />} />
    </Routes>,
    {
      initialRoute: `/orgs/1/repos/${repoId}`,
      user: testUser,
      org: testOrg,
    },
  );
}

describe('RepositoryDetailPage', () => {
  it('should render repo detail with all sections', async () => {
    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText('test-org/repo-1')).toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    expect(screen.getByText('GitHub Action Setup')).toBeInTheDocument();
    expect(screen.getByText('Automations')).toBeInTheDocument();
    expect(screen.getByText('Recent Executions')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Repository Info')).toBeInTheDocument();
  });

  it('should show configured status when workflow file exists', async () => {
    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText('Workflow file found')).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it('should show error for invalid repo ID', () => {
    renderPage({ repoId: 'invalid' });

    expect(screen.getByText('Invalid repository ID')).toBeInTheDocument();
  });

  it('should show error when repo not found', async () => {
    server.use(
      http.get('/api/orgs/:orgId/repos/:repoId', () => {
        return HttpResponse.json(
          { error: 'Not Found', message: 'Repository not found', statusCode: 404 },
          { status: 404 },
        );
      }),
    );

    renderPage({ repoId: '999' });

    await waitFor(
      () => {
        expect(screen.getByText(/not found|error/i)).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it('should show back button', async () => {
    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText('Back')).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });
});
