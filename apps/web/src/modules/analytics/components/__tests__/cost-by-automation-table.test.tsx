import { render, screen } from '@testing-library/react';
import { CostByAutomationTable } from '../cost-by-automation-table';
import type { AutomationCostBreakdown } from '../../types';

const data: AutomationCostBreakdown[] = [
  {
    automationId: 1,
    automationName: 'PR Review Bot',
    totalCostMicros: 3_000_000,
    executionCount: 15,
    totalInputTokens: 500_000,
    totalOutputTokens: 100_000,
  },
  {
    automationId: 2,
    automationName: 'Code Lint',
    totalCostMicros: 1_500_000,
    executionCount: 8,
    totalInputTokens: 200_000,
    totalOutputTokens: 50_000,
  },
];

describe('CostByAutomationTable', () => {
  it('should render the card title', () => {
    render(<CostByAutomationTable data={data} />);
    expect(screen.getByText('Top Costliest Automations')).toBeInTheDocument();
  });

  it('should render table headers', () => {
    render(<CostByAutomationTable data={data} />);
    expect(screen.getByText('Automation')).toBeInTheDocument();
    expect(screen.getByText('Executions')).toBeInTheDocument();
    expect(screen.getByText('Total Cost')).toBeInTheDocument();
  });

  it('should render automation rows', () => {
    render(<CostByAutomationTable data={data} />);
    expect(screen.getByText('PR Review Bot')).toBeInTheDocument();
    expect(screen.getByText('Code Lint')).toBeInTheDocument();
  });

  it('should format costs correctly', () => {
    render(<CostByAutomationTable data={data} />);
    expect(screen.getByText('$3.00')).toBeInTheDocument();
    expect(screen.getByText('$1.50')).toBeInTheDocument();
  });

  it('should render empty state when no data', () => {
    render(<CostByAutomationTable data={[]} />);
    expect(screen.getByText('No automation cost data available.')).toBeInTheDocument();
  });
});
