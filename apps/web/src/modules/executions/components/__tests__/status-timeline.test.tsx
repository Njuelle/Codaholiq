import { render, screen } from '@testing-library/react';
import { mockExecution } from '@/test/factories';
import { StatusTimeline } from '../status-timeline';

describe('StatusTimeline', () => {
  it('should render Created step for any execution', () => {
    const execution = mockExecution({ status: 'pending' });
    render(<StatusTimeline execution={execution} />);

    expect(screen.getByText('Created')).toBeInTheDocument();
  });

  it('should render Completed step for completed execution', () => {
    const execution = mockExecution({ status: 'completed' });
    render(<StatusTimeline execution={execution} />);

    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('should render Failed step for failed execution', () => {
    const execution = mockExecution({ status: 'failed' });
    render(<StatusTimeline execution={execution} />);

    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('should render Running step when execution has startedAt', () => {
    const execution = mockExecution({
      status: 'running',
      startedAt: '2025-01-01T00:00:10.000Z',
      completedAt: null,
    });
    render(<StatusTimeline execution={execution} />);

    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('should render Waiting step for pending execution', () => {
    const execution = mockExecution({
      status: 'pending',
      startedAt: null,
      completedAt: null,
    });
    render(<StatusTimeline execution={execution} />);

    expect(screen.getByText('Waiting')).toBeInTheDocument();
  });

  it('should render Cancelled step', () => {
    const execution = mockExecution({ status: 'cancelled' });
    render(<StatusTimeline execution={execution} />);

    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('should render Timed out step', () => {
    const execution = mockExecution({ status: 'timed_out' });
    render(<StatusTimeline execution={execution} />);

    expect(screen.getByText('Timed out')).toBeInTheDocument();
  });
});
