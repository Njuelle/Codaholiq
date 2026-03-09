import { render, screen } from '@testing-library/react';
import { CostSummaryCards } from '../cost-summary-cards';
import type { CostSummary } from '../../types';

const summary: CostSummary = {
  totalCostMicros: 5_000_000,
  totalInputTokens: 50_000,
  totalOutputTokens: 10_000,
  executionsWithCost: 10,
  averageCostMicros: 500_000,
};

describe('CostSummaryCards', () => {
  it('should render total cost', () => {
    render(<CostSummaryCards summary={summary} />);
    expect(screen.getByText('$5.00')).toBeInTheDocument();
  });

  it('should render average cost', () => {
    render(<CostSummaryCards summary={summary} />);
    expect(screen.getByText('$0.50')).toBeInTheDocument();
  });

  it('should render execution count on all cards', () => {
    render(<CostSummaryCards summary={summary} />);
    const elements = screen.getAllByText('10 executions with cost data');
    expect(elements.length).toBe(2);
  });

  it('should render card titles', () => {
    render(<CostSummaryCards summary={summary} />);
    expect(screen.getByText('Total Cost')).toBeInTheDocument();
    expect(screen.getByText('Avg Cost / Execution')).toBeInTheDocument();
  });

  it('should handle zero values', () => {
    const zeroSummary: CostSummary = {
      totalCostMicros: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      executionsWithCost: 0,
      averageCostMicros: 0,
    };
    render(<CostSummaryCards summary={zeroSummary} />);
    const zeroCosts = screen.getAllByText('$0.00');
    expect(zeroCosts.length).toBeGreaterThanOrEqual(2);
  });

  it('should use singular for 1 execution', () => {
    render(<CostSummaryCards summary={{ ...summary, executionsWithCost: 1 }} />);
    const elements = screen.getAllByText('1 execution with cost data');
    expect(elements.length).toBe(2);
  });
});
