import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/test-utils';
import { ModelPolicyCard } from '../model-policy-card';

const mockProviders = {
  providers: [
    {
      id: 'claude-code',
      name: 'Claude Code',
      description: 'Anthropic Claude',
      models: [
        { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', description: 'Sonnet' },
        { id: 'claude-opus-4-6-20250929', name: 'Claude Opus 4.6', description: 'Opus' },
      ],
      defaultModelId: 'claude-sonnet-4-5-20250929',
      secrets: [],
      modelIdPattern: '/^claude-/',
    },
    {
      id: 'codex',
      name: 'OpenAI Codex',
      description: 'OpenAI Codex',
      models: [{ id: 'codex-mini', name: 'Codex Mini', description: 'Mini' }],
      defaultModelId: 'codex-mini',
      secrets: [],
      modelIdPattern: '/^[a-z]/',
    },
  ],
  defaultProviderId: 'claude-code',
};

describe('ModelPolicyCard', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/providers', () => {
        return HttpResponse.json({ data: mockProviders, requestId: 'test' });
      }),
    );
  });

  it('should show unrestricted state', async () => {
    renderWithProviders(<ModelPolicyCard orgId={1} repoId={100} canManage={true} />);

    await waitFor(() => {
      expect(screen.getByText('All models are allowed on this repository.')).toBeInTheDocument();
    });
  });

  it('should show restricted state with allowed models', async () => {
    server.use(
      http.get('/api/orgs/:orgId/repos/:repoId/model-policies', () => {
        return HttpResponse.json({
          data: {
            policies: [
              {
                provider: 'claude-code',
                model: 'claude-sonnet-4-5-20250929',
                createdAt: '2025-01-01',
                createdBy: 1,
              },
            ],
            isRestricted: true,
          },
          requestId: 'test',
        });
      }),
    );

    renderWithProviders(<ModelPolicyCard orgId={1} repoId={100} canManage={true} />);

    await waitFor(() => {
      expect(screen.getByText('Only the following models are allowed:')).toBeInTheDocument();
    });

    expect(screen.getByText('Claude Sonnet 4.5')).toBeInTheDocument();
  });

  it('should show edit button only when canManage is true', async () => {
    renderWithProviders(<ModelPolicyCard orgId={1} repoId={100} canManage={true} />);

    await waitFor(() => {
      expect(screen.getByText('All models are allowed on this repository.')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('should not show edit button when canManage is false', async () => {
    renderWithProviders(<ModelPolicyCard orgId={1} repoId={100} canManage={false} />);

    await waitFor(() => {
      expect(screen.getByText('All models are allowed on this repository.')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
  });

  it('should enter edit mode and show checkboxes', async () => {
    const user = userEvent.setup();

    renderWithProviders(<ModelPolicyCard orgId={1} repoId={100} canManage={true} />);

    await waitFor(() => {
      expect(screen.getByText('All models are allowed on this repository.')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /edit/i }));

    expect(screen.getByText('Claude Code')).toBeInTheDocument();
    expect(screen.getByText('Claude Sonnet 4.5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save policy/i })).toBeInTheDocument();
  });
});
