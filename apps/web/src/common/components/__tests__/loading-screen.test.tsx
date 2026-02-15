import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { LoadingScreen } from '../loading-screen';

describe('LoadingScreen', () => {
  it('should render with accessible loading indicator', () => {
    renderWithProviders(<LoadingScreen />);

    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute('aria-label', 'Loading');
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });
});
