import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { UpcomingCronsCard } from '../upcoming-crons-card';
import type { UpcomingCronTrigger } from '@/common/types';

const triggers: UpcomingCronTrigger[] = [
  {
    automationId: 1,
    automationName: 'Nightly Build',
    nextFireAt: '2025-06-15T03:00:00.000Z',
  },
  {
    automationId: 2,
    automationName: 'Weekly Report',
    nextFireAt: '2025-06-16T09:00:00.000Z',
  },
];

describe('UpcomingCronsCard', () => {
  it('should render upcoming triggers', () => {
    renderWithProviders(<UpcomingCronsCard triggers={triggers} orgId={1} />);

    expect(screen.getByText('Nightly Build')).toBeInTheDocument();
    expect(screen.getByText('Weekly Report')).toBeInTheDocument();
  });

  it('should render empty state', () => {
    renderWithProviders(<UpcomingCronsCard triggers={[]} orgId={1} />);

    expect(screen.getByText('No upcoming cron triggers.')).toBeInTheDocument();
  });

  it('should link automation names to automation detail', () => {
    renderWithProviders(<UpcomingCronsCard triggers={triggers} orgId={1} />);

    const link = screen.getByRole('link', { name: 'Nightly Build' });
    expect(link).toHaveAttribute('href', '/orgs/1/automations/1');
  });
});
