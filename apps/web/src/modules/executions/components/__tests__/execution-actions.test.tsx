import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { mockExecution } from '@/test/factories';
import { ExecutionActions } from '../execution-actions';

describe('ExecutionActions', () => {
  it('should show Cancel button for running execution', () => {
    render(
      <MemoryRouter>
        <ExecutionActions
          execution={mockExecution({ status: 'running' })}
          onCancel={vi.fn()}
          onRetry={vi.fn()}
          isCancelling={false}
          isRetrying={false}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  it('should show Retry button for failed execution', () => {
    render(
      <MemoryRouter>
        <ExecutionActions
          execution={mockExecution({ status: 'failed' })}
          onCancel={vi.fn()}
          onRetry={vi.fn()}
          isCancelling={false}
          isRetrying={false}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
  });

  it('should show no action buttons for completed execution', () => {
    render(
      <MemoryRouter>
        <ExecutionActions
          execution={mockExecution({ status: 'completed' })}
          onCancel={vi.fn()}
          onRetry={vi.fn()}
          isCancelling={false}
          isRetrying={false}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  it('should call onCancel when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <MemoryRouter>
        <ExecutionActions
          execution={mockExecution({ status: 'running' })}
          onCancel={onCancel}
          onRetry={vi.fn()}
          isCancelling={false}
          isRetrying={false}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('should call onRetry when Retry is clicked', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <MemoryRouter>
        <ExecutionActions
          execution={mockExecution({ status: 'failed' })}
          onCancel={vi.fn()}
          onRetry={onRetry}
          isCancelling={false}
          isRetrying={false}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('should show "View on GitHub" when URL exists', () => {
    render(
      <MemoryRouter>
        <ExecutionActions
          execution={mockExecution({
            status: 'completed',
            githubRunUrl: 'https://github.com/runs/123',
          })}
          onCancel={vi.fn()}
          onRetry={vi.fn()}
          isCancelling={false}
          isRetrying={false}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /view on github/i })).toBeInTheDocument();
  });

  it('should show Cancel for pending and dispatching statuses', () => {
    for (const status of ['pending', 'dispatching'] as const) {
      const { unmount } = render(
        <MemoryRouter>
          <ExecutionActions
            execution={mockExecution({ status })}
            onCancel={vi.fn()}
            onRetry={vi.fn()}
            isCancelling={false}
            isRetrying={false}
          />
        </MemoryRouter>,
      );
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      unmount();
    }
  });

  it('should show Retry for cancelled and timed_out statuses', () => {
    for (const status of ['cancelled', 'timed_out'] as const) {
      const { unmount } = render(
        <MemoryRouter>
          <ExecutionActions
            execution={mockExecution({ status })}
            onCancel={vi.fn()}
            onRetry={vi.fn()}
            isCancelling={false}
            isRetrying={false}
          />
        </MemoryRouter>,
      );
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      unmount();
    }
  });
});
