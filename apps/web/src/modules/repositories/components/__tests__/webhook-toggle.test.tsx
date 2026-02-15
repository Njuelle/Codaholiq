import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { WebhookToggle } from '../webhook-toggle';

describe('WebhookToggle', () => {
  it('should render toggle with label', () => {
    renderWithProviders(
      <WebhookToggle isActive={true} onToggle={vi.fn()} isPending={false} canEdit={true} />,
    );

    expect(screen.getByText('Webhook processing')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('should show unchecked state when inactive', () => {
    renderWithProviders(
      <WebhookToggle isActive={false} onToggle={vi.fn()} isPending={false} canEdit={true} />,
    );

    expect(screen.getByRole('switch')).not.toBeChecked();
  });

  it('should call onToggle when clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    renderWithProviders(
      <WebhookToggle isActive={true} onToggle={onToggle} isPending={false} canEdit={true} />,
    );

    await user.click(screen.getByRole('switch'));

    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('should be disabled when user cannot edit', () => {
    renderWithProviders(
      <WebhookToggle isActive={true} onToggle={vi.fn()} isPending={false} canEdit={false} />,
    );

    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('should be disabled when pending', () => {
    renderWithProviders(
      <WebhookToggle isActive={true} onToggle={vi.fn()} isPending={true} canEdit={true} />,
    );

    expect(screen.getByRole('switch')).toBeDisabled();
  });
});
