import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TopCostliestAutomationsCard } from '../top-costliest-automations-card';
import type { AutomationCostBreakdown } from '@/common/types';

const automations: AutomationCostBreakdown[] = [
  {
    automationId: 1,
    automationName: 'PR Review Bot',
    totalCostMicros: 5_000_000,
    executionCount: 20,
    totalInputTokens: 500_000,
    totalOutputTokens: 80_000,
  },
  {
    automationId: 2,
    automationName: 'Nightly Build',
    totalCostMicros: 2_000_000,
    executionCount: 10,
    totalInputTokens: 200_000,
    totalOutputTokens: 30_000,
  },
];

function renderCard(props?: { automations?: readonly AutomationCostBreakdown[] }): void {
  render(
    <MemoryRouter>
      <TopCostliestAutomationsCard automations={props?.automations ?? automations} orgId={1} />
    </MemoryRouter>,
  );
}

describe('TopCostliestAutomationsCard', () => {
  it('should render the card title', () => {
    renderCard();

    expect(screen.getByText('Top Costliest Automations (30d)')).toBeInTheDocument();
  });

  it('should render automation names as links', () => {
    renderCard();

    const prReviewLink = screen.getByRole('link', { name: 'PR Review Bot' });
    expect(prReviewLink).toBeInTheDocument();
    expect(prReviewLink).toHaveAttribute('href', '/orgs/1/automations/1');

    const nightlyLink = screen.getByRole('link', { name: 'Nightly Build' });
    expect(nightlyLink).toHaveAttribute('href', '/orgs/1/automations/2');
  });

  it('should display cost per automation', () => {
    renderCard();

    expect(screen.getByText('$5.00')).toBeInTheDocument();
    expect(screen.getByText('$2.00')).toBeInTheDocument();
  });

  it('should display execution count and token breakdown', () => {
    renderCard();

    expect(screen.getByText(/20 executions/)).toBeInTheDocument();
    expect(screen.getByText(/500\.0K in/)).toBeInTheDocument();
  });

  it('should show empty state when no data', () => {
    renderCard({ automations: [] });

    expect(screen.getByText('No cost data available yet.')).toBeInTheDocument();
  });
});
