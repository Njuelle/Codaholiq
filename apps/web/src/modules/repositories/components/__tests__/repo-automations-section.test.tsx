import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/test-utils';
import { mockAutomation } from '@/test/factories';
import { RepoAutomationsSection } from '../repo-automations-section';

describe('RepoAutomationsSection', () => {
  it('should render automations for the repo and pass repoId filter', async () => {
    let capturedUrl: URL | undefined;
    server.use(
      http.get('/api/orgs/:orgId/automations', ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json({
          data: [
            mockAutomation({ id: 1, name: 'Deploy Bot', triggerType: 'event' }),
            mockAutomation({ id: 2, name: 'Nightly Scan', triggerType: 'cron' }),
          ],
          requestId: 'test-request-id',
        });
      }),
    );

    renderWithProviders(<RepoAutomationsSection orgId={1} repoId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Deploy Bot')).toBeInTheDocument();
    });

    expect(capturedUrl?.searchParams.get('repoId')).toBe('1');
    expect(screen.getByText('Nightly Scan')).toBeInTheDocument();
    expect(screen.getByText('Event')).toBeInTheDocument();
    expect(screen.getByText('Cron')).toBeInTheDocument();
  });

  it('should show empty state when no automations', async () => {
    server.use(
      http.get('/api/orgs/:orgId/automations', () => {
        return HttpResponse.json({
          data: [],
          requestId: 'test-request-id',
        });
      }),
    );

    renderWithProviders(<RepoAutomationsSection orgId={1} repoId={1} />);

    await waitFor(() => {
      expect(
        screen.getByText('No automations configured for this repository.'),
      ).toBeInTheDocument();
    });
  });

  it('should show create automation link', () => {
    renderWithProviders(<RepoAutomationsSection orgId={1} repoId={1} />);

    expect(screen.getByText('Create')).toBeInTheDocument();
  });
});
