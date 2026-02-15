import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { SetupStatusCard } from '../setup-status-card';

describe('SetupStatusCard', () => {
  it('should show loading skeleton when loading', () => {
    renderWithProviders(
      <SetupStatusCard workflowFileExists={undefined} isLoading={true} isError={false} />,
    );

    expect(screen.getByText('GitHub Action Setup')).toBeInTheDocument();
  });

  it('should show error message on error', () => {
    renderWithProviders(
      <SetupStatusCard workflowFileExists={undefined} isLoading={false} isError={true} />,
    );

    expect(screen.getByText('Unable to check setup status.')).toBeInTheDocument();
  });

  it('should show configured state when workflow file exists', () => {
    renderWithProviders(
      <SetupStatusCard workflowFileExists={true} isLoading={false} isError={false} />,
    );

    expect(screen.getByText('Workflow file found')).toBeInTheDocument();
  });

  it('should show unconfigured state with YAML when workflow file does not exist', () => {
    renderWithProviders(
      <SetupStatusCard workflowFileExists={false} isLoading={false} isError={false} />,
    );

    expect(screen.getByText('Workflow file not found')).toBeInTheDocument();
    expect(screen.getByText(/\.github\/workflows\/codaholiq\.yml/)).toBeInTheDocument();
    expect(screen.getByText(/workflow_dispatch/)).toBeInTheDocument();
  });

  it('should copy YAML when copy button is clicked', async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    renderWithProviders(
      <SetupStatusCard workflowFileExists={false} isLoading={false} isError={false} />,
    );

    const copyButton = screen.getByRole('button');
    await user.click(copyButton);

    expect(writeTextMock).toHaveBeenCalled();
  });
});
