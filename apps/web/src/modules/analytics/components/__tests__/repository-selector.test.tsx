import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockRepo } from '@/test/factories';
import { RepositorySelector } from '../repository-selector';

// Polyfill missing DOM APIs for jsdom (required by Radix Select)
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const repos = [
  mockRepo({ id: 1, fullName: 'org/repo-alpha' }),
  mockRepo({ id: 2, fullName: 'org/repo-beta' }),
];

describe('RepositorySelector', () => {
  it('should render with "All Repositories" selected by default', () => {
    render(<RepositorySelector repoId={undefined} repositories={repos} onRepoIdChange={vi.fn()} />);

    expect(screen.getByText('All Repositories')).toBeInTheDocument();
  });

  it('should show repository options when opened', async () => {
    const user = userEvent.setup();

    render(<RepositorySelector repoId={undefined} repositories={repos} onRepoIdChange={vi.fn()} />);

    await user.click(screen.getByRole('combobox'));

    expect(screen.getByText('org/repo-alpha')).toBeInTheDocument();
    expect(screen.getByText('org/repo-beta')).toBeInTheDocument();
  });

  it('should call onRepoIdChange with repo id when a repo is selected', async () => {
    const user = userEvent.setup();
    const onRepoIdChange = vi.fn();

    render(
      <RepositorySelector
        repoId={undefined}
        repositories={repos}
        onRepoIdChange={onRepoIdChange}
      />,
    );

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('org/repo-alpha'));

    expect(onRepoIdChange).toHaveBeenCalledWith(1);
  });

  it('should call onRepoIdChange with undefined when "All Repositories" is selected', async () => {
    const user = userEvent.setup();
    const onRepoIdChange = vi.fn();

    render(<RepositorySelector repoId={1} repositories={repos} onRepoIdChange={onRepoIdChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('All Repositories'));

    expect(onRepoIdChange).toHaveBeenCalledWith(undefined);
  });

  it('should display the selected repository name', () => {
    render(<RepositorySelector repoId={2} repositories={repos} onRepoIdChange={vi.fn()} />);

    expect(screen.getByText('org/repo-beta')).toBeInTheDocument();
  });
});
