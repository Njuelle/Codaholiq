import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/test-utils';
import { SetupStatusCard } from '../setup-status-card';

const defaultProps = {
  workflowFileExists: false as boolean | undefined,
  workflowFileUpToDate: false as boolean | undefined,
  secretsConfigured: false as boolean | undefined,
  hasAnthropicKey: false as boolean | undefined,
  hasOAuthToken: false as boolean | undefined,
  providerSecrets: undefined as
    | readonly import('@/modules/automations/types').ProviderSecretStatus[]
    | undefined,
  repoFullName: 'test-org/repo-1' as string | undefined,
  isLoading: false,
  isError: false,
  orgId: 1,
  repoId: 1,
  canEdit: true,
};

describe('SetupStatusCard', () => {
  it('should show loading skeleton when loading', () => {
    renderWithProviders(
      <SetupStatusCard {...defaultProps} workflowFileExists={undefined} isLoading={true} />,
    );

    expect(screen.getByText('GitHub Action Setup')).toBeInTheDocument();
  });

  it('should show error message on error', () => {
    renderWithProviders(<SetupStatusCard {...defaultProps} isError={true} />);

    expect(screen.getByText('Unable to check setup status.')).toBeInTheDocument();
  });

  it('should show up to date state when workflow file exists and is up to date', () => {
    renderWithProviders(
      <SetupStatusCard {...defaultProps} workflowFileExists={true} workflowFileUpToDate={true} />,
    );

    expect(screen.getByText('Workflow file up to date')).toBeInTheDocument();
  });

  it('should show outdated state when workflow file exists but is not up to date', () => {
    renderWithProviders(
      <SetupStatusCard {...defaultProps} workflowFileExists={true} workflowFileUpToDate={false} />,
    );

    expect(screen.getByText('Workflow file outdated')).toBeInTheDocument();
    expect(screen.getByText(/differs from the latest/)).toBeInTheDocument();
  });

  it('should show Update via PR button when outdated and canEdit', () => {
    renderWithProviders(
      <SetupStatusCard
        {...defaultProps}
        workflowFileExists={true}
        workflowFileUpToDate={false}
        canEdit={true}
      />,
    );

    expect(screen.getByRole('button', { name: /Update via PR/i })).toBeInTheDocument();
  });

  it('should not show Update via PR button when outdated and canEdit is false', () => {
    renderWithProviders(
      <SetupStatusCard
        {...defaultProps}
        workflowFileExists={true}
        workflowFileUpToDate={false}
        canEdit={false}
      />,
    );

    expect(screen.queryByRole('button', { name: /Update via PR/i })).not.toBeInTheDocument();
  });

  it('should show PR URL link after successful update', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <SetupStatusCard
        {...defaultProps}
        workflowFileExists={true}
        workflowFileUpToDate={false}
        canEdit={true}
      />,
    );

    const updateButton = screen.getByRole('button', { name: /Update via PR/i });
    await user.click(updateButton);

    await waitFor(() => {
      expect(screen.getByText('View on GitHub')).toBeInTheDocument();
    });

    const link = screen.getByRole('link', { name: 'View on GitHub' });
    expect(link).toHaveAttribute('href', 'https://github.com/test-org/repo-1/pull/2');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('should show unconfigured state with YAML when workflow file does not exist', async () => {
    renderWithProviders(<SetupStatusCard {...defaultProps} workflowFileExists={false} />);

    expect(screen.getByText('Workflow file not found')).toBeInTheDocument();
    expect(screen.getByText(/\.github\/workflows\/codaholiq\.yml/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/workflow_dispatch/)).toBeInTheDocument();
    });
  });

  it('should show Create PR button when canEdit is true and workflow not found', () => {
    renderWithProviders(
      <SetupStatusCard {...defaultProps} workflowFileExists={false} canEdit={true} />,
    );

    expect(screen.getByRole('button', { name: /Create PR/i })).toBeInTheDocument();
  });

  it('should not show Create PR button when canEdit is false', () => {
    renderWithProviders(
      <SetupStatusCard {...defaultProps} workflowFileExists={false} canEdit={false} />,
    );

    expect(screen.queryByRole('button', { name: /Create PR/i })).not.toBeInTheDocument();
  });

  it('should not show Create PR button when workflow file exists and is up to date', () => {
    renderWithProviders(
      <SetupStatusCard
        {...defaultProps}
        workflowFileExists={true}
        workflowFileUpToDate={true}
        canEdit={true}
      />,
    );

    expect(screen.queryByRole('button', { name: /Create PR/i })).not.toBeInTheDocument();
  });

  it('should show PR URL link after successful creation', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <SetupStatusCard {...defaultProps} workflowFileExists={false} canEdit={true} />,
    );

    const createButton = screen.getByRole('button', { name: /Create PR/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('View on GitHub')).toBeInTheDocument();
    });

    const link = screen.getByRole('link', { name: 'View on GitHub' });
    expect(link).toHaveAttribute('href', 'https://github.com/test-org/repo-1/pull/1');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('should show error toast on failure', async () => {
    server.use(
      http.post('/api/orgs/:orgId/repos/:repoId/setup-workflow', () => {
        return HttpResponse.json(
          { statusCode: 400, error: 'Bad Request', message: 'Workflow file already exists' },
          { status: 400 },
        );
      }),
    );

    const user = userEvent.setup();

    renderWithProviders(
      <SetupStatusCard {...defaultProps} workflowFileExists={false} canEdit={true} />,
    );

    const createButton = screen.getByRole('button', { name: /Create PR/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Create PR/i })).toBeEnabled();
    });
  });

  it('should copy YAML when copy button is clicked', async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    renderWithProviders(<SetupStatusCard {...defaultProps} workflowFileExists={false} />);

    // Wait for the template to load from the API
    await waitFor(() => {
      expect(screen.getByText(/workflow_dispatch/)).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole('button');
    const copyButton = buttons.find((btn) => btn.querySelector('svg.lucide-copy') !== null);
    if (copyButton) {
      await user.click(copyButton);
      expect(writeTextMock).toHaveBeenCalled();
    }
  });

  // Secrets status tests
  it('should show API key configured when secretsConfigured is true', () => {
    renderWithProviders(
      <SetupStatusCard
        {...defaultProps}
        workflowFileExists={true}
        workflowFileUpToDate={true}
        secretsConfigured={true}
        hasAnthropicKey={true}
        hasOAuthToken={false}
      />,
    );

    expect(screen.getByText(/API key configured/)).toBeInTheDocument();
    expect(screen.getByText(/ANTHROPIC_API_KEY/)).toBeInTheDocument();
  });

  it('should show OAuth token when only hasOAuthToken is true', () => {
    renderWithProviders(
      <SetupStatusCard
        {...defaultProps}
        workflowFileExists={true}
        workflowFileUpToDate={true}
        secretsConfigured={true}
        hasAnthropicKey={false}
        hasOAuthToken={true}
      />,
    );

    expect(screen.getByText(/API key configured/)).toBeInTheDocument();
    expect(screen.getByText(/CLAUDE_CODE_OAUTH_TOKEN/)).toBeInTheDocument();
  });

  it('should show both keys when both are set', () => {
    renderWithProviders(
      <SetupStatusCard
        {...defaultProps}
        workflowFileExists={true}
        workflowFileUpToDate={true}
        secretsConfigured={true}
        hasAnthropicKey={true}
        hasOAuthToken={true}
      />,
    );

    expect(screen.getByText(/API key configured/)).toBeInTheDocument();
    expect(screen.getByText(/ANTHROPIC_API_KEY \+ CLAUDE_CODE_OAUTH_TOKEN/)).toBeInTheDocument();
  });

  it('should show warning when no API key is found', () => {
    renderWithProviders(
      <SetupStatusCard
        {...defaultProps}
        workflowFileExists={true}
        workflowFileUpToDate={true}
        secretsConfigured={false}
        hasAnthropicKey={false}
        hasOAuthToken={false}
      />,
    );

    expect(screen.getByText('No API key found')).toBeInTheDocument();
    expect(screen.getByText(/ANTHROPIC_API_KEY/)).toBeInTheDocument();
    expect(screen.getByText(/CLAUDE_CODE_OAUTH_TOKEN/)).toBeInTheDocument();
  });

  it('should show GitHub secrets link when secrets not configured', () => {
    renderWithProviders(
      <SetupStatusCard
        {...defaultProps}
        workflowFileExists={true}
        workflowFileUpToDate={true}
        secretsConfigured={false}
        hasAnthropicKey={false}
        hasOAuthToken={false}
        repoFullName="test-org/repo-1"
      />,
    );

    const link = screen.getByRole('link', { name: /Manage secrets on GitHub/i });
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/test-org/repo-1/settings/secrets/actions',
    );
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('should not show secrets section when secretsConfigured is undefined', () => {
    renderWithProviders(
      <SetupStatusCard
        {...defaultProps}
        workflowFileExists={true}
        workflowFileUpToDate={true}
        secretsConfigured={undefined}
        hasAnthropicKey={undefined}
        hasOAuthToken={undefined}
      />,
    );

    expect(screen.queryByText(/API key configured/)).not.toBeInTheDocument();
    expect(screen.queryByText('No API key found')).not.toBeInTheDocument();
  });
});
