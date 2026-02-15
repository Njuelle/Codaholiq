import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { ThemeToggle } from '../theme-toggle';

describe('ThemeToggle', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('should render the toggle button', () => {
    renderWithProviders(<ThemeToggle />);
    expect(screen.getByRole('button', { name: 'Toggle theme' })).toBeInTheDocument();
  });

  it('should show theme options when clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeToggle />);

    await user.click(screen.getByRole('button', { name: 'Toggle theme' }));

    expect(screen.getByRole('menuitemradio', { name: /light/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /dark/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /system/i })).toBeInTheDocument();
  });

  it('should apply dark class when dark theme is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeToggle />);

    await user.click(screen.getByRole('button', { name: 'Toggle theme' }));
    await user.click(screen.getByRole('menuitemradio', { name: /dark/i }));

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
