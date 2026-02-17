import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { CatalogTemplateCard } from '../catalog-template-card';
import type { CatalogTemplate } from '@/common/types';

const mockTemplate: CatalogTemplate = {
  slug: 'pr-code-review',
  name: 'PR Code Review',
  description: 'Automatically reviews pull requests for code quality.',
  category: 'Code Quality',
  icon: 'search-code',
  triggerType: 'event',
  triggerConfig: { events: ['pull_request.opened'] },
  promptTemplate: 'Review the PR.',
  model: null,
  variables: [],
};

describe('CatalogTemplateCard', () => {
  it('should render template name and description', () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <CatalogTemplateCard template={mockTemplate} onSelect={onSelect} />,
    );

    expect(screen.getByText('PR Code Review')).toBeInTheDocument();
    expect(
      screen.getByText('Automatically reviews pull requests for code quality.'),
    ).toBeInTheDocument();
  });

  it('should render trigger type badge', () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <CatalogTemplateCard template={mockTemplate} onSelect={onSelect} />,
    );

    expect(screen.getByText('Event')).toBeInTheDocument();
  });

  it('should render scheduled badge for cron trigger', () => {
    const cronTemplate: CatalogTemplate = {
      ...mockTemplate,
      triggerType: 'cron',
      triggerConfig: { schedule: '0 2 * * *' },
    };
    const onSelect = vi.fn();
    renderWithProviders(
      <CatalogTemplateCard template={cronTemplate} onSelect={onSelect} />,
    );

    expect(screen.getByText('Scheduled')).toBeInTheDocument();
  });

  it('should call onSelect when clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProviders(
      <CatalogTemplateCard template={mockTemplate} onSelect={onSelect} />,
    );

    await user.click(screen.getByText('PR Code Review'));

    expect(onSelect).toHaveBeenCalledWith(mockTemplate);
  });

  it('should call onSelect on Enter key press', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProviders(
      <CatalogTemplateCard template={mockTemplate} onSelect={onSelect} />,
    );

    const card = screen.getByRole('button');
    card.focus();
    await user.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledWith(mockTemplate);
  });
});
