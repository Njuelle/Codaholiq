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
    'cost_blocked',
  ];

  it.each(statuses)('should render %s status', (status) => {
    render(<StatusBadge status={status} />);
    const labelMap: Partial<Record<ExecutionStatus, string>> = {
      timed_out: 'Timed out',
      cost_blocked: 'Cost blocked',
    };
    const expectedLabel = labelMap[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
    expect(screen.getByText(expectedLabel)).toBeInTheDocument();
  });

  it('renders cost_blocked status with correct label and style', () => {
    const { container } = render(<StatusBadge status="cost_blocked" />);
    expect(screen.getByText('Cost blocked')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('bg-amber-100');
    expect(container.firstChild).toHaveClass('text-amber-800');
  });

  it('should apply custom className', () => {
    const { container } = render(<StatusBadge status="completed" className="extra-class" />);
    expect(container.firstChild).toHaveClass('extra-class');
  });
});
