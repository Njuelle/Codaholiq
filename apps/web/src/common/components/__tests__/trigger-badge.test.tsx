import { render, screen } from '@testing-library/react';
import { TriggerBadge } from '../trigger-badge';
import type { TriggerType } from '@/common/types';

describe('TriggerBadge', () => {
  it('should render "Event" text for event trigger type', () => {
    render(<TriggerBadge triggerType="event" />);
    expect(screen.getByText('Event')).toBeInTheDocument();
  });

  it('should render "Cron" text for cron trigger type', () => {
    render(<TriggerBadge triggerType="cron" />);
    expect(screen.getByText('Cron')).toBeInTheDocument();
  });

  it('should render "Manual" text for manual trigger type', () => {
    render(<TriggerBadge triggerType="manual" />);
    expect(screen.getByText('Manual')).toBeInTheDocument();
  });

  it.each<{ type: TriggerType; label: string }>([
    { type: 'event', label: 'Event' },
    { type: 'cron', label: 'Cron' },
    { type: 'manual', label: 'Manual' },
  ])('should render $label label for $type trigger type', ({ type, label }) => {
    render(<TriggerBadge triggerType={type} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('should render an icon alongside the label', () => {
    const { container } = render(<TriggerBadge triggerType="event" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should render different icons for each trigger type', () => {
    const { container: eventContainer } = render(<TriggerBadge triggerType="event" />);
    const { container: cronContainer } = render(<TriggerBadge triggerType="cron" />);
    const { container: manualContainer } = render(<TriggerBadge triggerType="manual" />);

    const eventSvg = eventContainer.querySelector('svg');
    const cronSvg = cronContainer.querySelector('svg');
    const manualSvg = manualContainer.querySelector('svg');

    expect(eventSvg).toBeInTheDocument();
    expect(cronSvg).toBeInTheDocument();
    expect(manualSvg).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<TriggerBadge triggerType="event" className="extra-class" />);
    expect(container.firstChild).toHaveClass('extra-class');
  });

  it('should apply event-specific styling', () => {
    const { container } = render(<TriggerBadge triggerType="event" />);
    expect(container.firstChild).toHaveClass('bg-blue-100');
  });

  it('should apply cron-specific styling', () => {
    const { container } = render(<TriggerBadge triggerType="cron" />);
    expect(container.firstChild).toHaveClass('bg-purple-100');
  });

  it('should apply manual-specific styling', () => {
    const { container } = render(<TriggerBadge triggerType="manual" />);
    expect(container.firstChild).toHaveClass('bg-gray-100');
  });
});
