import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../status-badge';
import type { ExecutionStatus } from '@/modules/executions/types';

describe('StatusBadge', () => {
  const statuses: ExecutionStatus[] = [
    'pending',
    'dispatching',
    'running',
    'completed',
    'failed',
    'cancelled',
    'timed_out',
  ];

  it.each(statuses)('should render %s status', (status) => {
    render(<StatusBadge status={status} />);
    expect(
      screen.getByText(
        status === 'timed_out' ? 'Timed out' : status.charAt(0).toUpperCase() + status.slice(1),
      ),
    ).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<StatusBadge status="completed" className="extra-class" />);
    expect(container.firstChild).toHaveClass('extra-class');
  });
});
