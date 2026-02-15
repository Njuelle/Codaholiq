import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { mockRepo } from '@/test/factories';
import { RepoTable } from '../repo-table';
import type { Repository } from '@/common/types';

const repos: Repository[] = [
  mockRepo({
    id: 1,
    fullName: 'test-org/frontend',
    language: 'TypeScript',
    private: false,
    defaultBranch: 'main',
    webhookActive: true,
  }),
  mockRepo({
    id: 2,
    fullName: 'test-org/api',
    language: null,
    private: true,
    defaultBranch: 'develop',
    webhookActive: false,
  }),
  mockRepo({
    id: 3,
    fullName: 'test-org/docs',
    language: 'Python',
    private: false,
    defaultBranch: 'main',
    webhookActive: true,
  }),
];

describe('RepoTable', () => {
  it('should render repository rows', () => {
    renderWithProviders(<RepoTable repos={repos} orgId={10} />);

    expect(screen.getByText('test-org/frontend')).toBeInTheDocument();
    expect(screen.getByText('test-org/api')).toBeInTheDocument();
    expect(screen.getByText('test-org/docs')).toBeInTheDocument();
  });

  it('should display language or dash', () => {
    renderWithProviders(<RepoTable repos={repos} orgId={10} />);

    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('should show Private/Public badge', () => {
    renderWithProviders(<RepoTable repos={repos} orgId={10} />);

    const privateBadges = screen.getAllByText('Private');
    const publicBadges = screen.getAllByText('Public');

    expect(privateBadges).toHaveLength(1);
    expect(publicBadges).toHaveLength(2);
  });

  it('should render column headers', () => {
    renderWithProviders(<RepoTable repos={repos} orgId={10} />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Language')).toBeInTheDocument();
    expect(screen.getByText('Visibility')).toBeInTheDocument();
    expect(screen.getByText('Default Branch')).toBeInTheDocument();
    expect(screen.getByText('Webhook')).toBeInTheDocument();
  });

  it('should display default branch', () => {
    renderWithProviders(<RepoTable repos={repos} orgId={10} />);

    const mainBranches = screen.getAllByText('main');
    expect(mainBranches.length).toBe(2);
    expect(screen.getByText('develop')).toBeInTheDocument();
  });

  it('should show webhook status indicators', () => {
    renderWithProviders(<RepoTable repos={repos} orgId={10} />);

    const activeIndicators = screen.getAllByLabelText('Webhook active');
    const inactiveIndicators = screen.getAllByLabelText('Webhook inactive');

    expect(activeIndicators).toHaveLength(2);
    expect(inactiveIndicators).toHaveLength(1);
  });

  it('should have clickable rows', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RepoTable repos={repos} orgId={10} />);

    const row = screen.getByText('test-org/frontend').closest('tr');
    expect(row).toBeInTheDocument();
    expect(row).toHaveClass('cursor-pointer');
    await user.click(row!);
  });
});
