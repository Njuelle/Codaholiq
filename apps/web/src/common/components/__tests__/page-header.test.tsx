import { render, screen } from '@testing-library/react';
import { PageHeader } from '../page-header';

describe('PageHeader', () => {
  it('should render title', () => {
    render(<PageHeader title="Dashboard" />);
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('should render description when provided', () => {
    render(<PageHeader title="Dashboard" description="Overview of activity." />);
    expect(screen.getByText('Overview of activity.')).toBeInTheDocument();
  });

  it('should render actions when provided', () => {
    render(<PageHeader title="Automations" actions={<button type="button">New</button>} />);
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
  });

  it('should not render description when not provided', () => {
    const { container } = render(<PageHeader title="Dashboard" />);
    expect(container.querySelectorAll('p')).toHaveLength(0);
  });
});
