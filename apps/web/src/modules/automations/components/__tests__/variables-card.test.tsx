import { render, screen } from '@testing-library/react';
import { mockAutomationVariable } from '@/test/factories';
import { VariablesCard } from '../variables-card';

describe('VariablesCard', () => {
  it('should render variable keys and sources', () => {
    const variables = [
      mockAutomationVariable({ key: 'API_URL', value: 'https://example.com', source: 'static' }),
      mockAutomationVariable({ key: 'BRANCH', value: '$.ref', source: 'event_payload' }),
    ];

    render(<VariablesCard variables={variables} />);

    expect(screen.getByText('Variables')).toBeInTheDocument();
    expect(screen.getByText('API_URL')).toBeInTheDocument();
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
    expect(screen.getByText('Static')).toBeInTheDocument();
    expect(screen.getByText('BRANCH')).toBeInTheDocument();
    expect(screen.getByText('$.ref')).toBeInTheDocument();
    expect(screen.getByText('Event Payload')).toBeInTheDocument();
  });

  it('should show empty state when no variables', () => {
    render(<VariablesCard variables={[]} />);

    expect(screen.getByText('Variables')).toBeInTheDocument();
    expect(screen.getByText('No variables configured.')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('should display the correct count badge', () => {
    const variables = [
      mockAutomationVariable({ key: 'A' }),
      mockAutomationVariable({ key: 'B' }),
      mockAutomationVariable({ key: 'C' }),
    ];

    render(<VariablesCard variables={variables} />);

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should render table headers when variables exist', () => {
    const variables = [mockAutomationVariable()];

    render(<VariablesCard variables={variables} />);

    expect(screen.getByText('Key')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
    expect(screen.getByText('Source')).toBeInTheDocument();
    expect(screen.getByText('Required')).toBeInTheDocument();
  });
});
