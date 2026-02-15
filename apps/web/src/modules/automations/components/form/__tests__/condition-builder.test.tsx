import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { ConditionBuilder } from '../condition-builder';
import type { ConditionGroup } from '@/common/types';

vi.mock('@/modules/automations/hooks/use-github-events', () => ({
  useGitHubEvents: vi.fn().mockReturnValue({
    categories: [],
    events: [
      {
        event: 'push',
        description: 'Push',
        category: 'code_and_commits',
        actions: [],
        payloadPaths: [
          { path: 'ref', description: 'Branch or tag ref' },
          { path: 'pusher.name', description: 'Pusher username' },
        ],
      },
      {
        event: 'pull_request',
        description: 'PR',
        category: 'pull_requests',
        actions: [{ name: 'opened', description: 'Opened' }],
        payloadPaths: [
          { path: 'pull_request.base.ref', description: 'Target branch' },
          { path: 'pull_request.draft', description: 'Is draft' },
          { path: 'pull_request.user.login', description: 'PR author' },
        ],
      },
      {
        event: 'issues',
        description: 'Issues',
        category: 'issues',
        actions: [{ name: 'labeled', description: 'Labeled' }],
        payloadPaths: [
          { path: 'label.name', description: 'Label name' },
          { path: 'issue.title', description: 'Issue title' },
        ],
      },
      {
        event: 'workflow_run',
        description: 'Workflow run',
        category: 'ci_cd',
        actions: [{ name: 'completed', description: 'Completed' }],
        payloadPaths: [
          { path: 'workflow_run.name', description: 'Workflow name' },
          { path: 'workflow_run.conclusion', description: 'Conclusion' },
        ],
      },
    ],
    isLoading: false,
  }),
  getPayloadPathsForEvents: vi
    .fn()
    .mockImplementation(({ events }: { events: readonly string[] }) => {
      const pathMap: Record<string, Array<{ path: string; description: string }>> = {
        push: [
          { path: 'ref', description: 'Branch or tag ref' },
          { path: 'pusher.name', description: 'Pusher username' },
        ],
        pull_request: [
          { path: 'pull_request.base.ref', description: 'Target branch' },
          { path: 'pull_request.draft', description: 'Is draft' },
          { path: 'pull_request.user.login', description: 'PR author' },
        ],
        issues: [
          { path: 'label.name', description: 'Label name' },
          { path: 'issue.title', description: 'Issue title' },
        ],
        workflow_run: [
          { path: 'workflow_run.name', description: 'Workflow name' },
          { path: 'workflow_run.conclusion', description: 'Conclusion' },
        ],
      };
      const result: Array<{ path: string; description: string }> = [];
      const seen = new Set<string>();
      for (const e of events) {
        const base = e.split('.')[0]!;
        const paths = pathMap[base] ?? [];
        for (const p of paths) {
          if (!seen.has(p.path)) {
            seen.add(p.path);
            result.push(p);
          }
        }
      }
      return result;
    }),
}));

describe('ConditionBuilder', () => {
  const defaultProps = {
    conditionGroups: [] as ConditionGroup[],
    selectedEvents: ['push'] as readonly string[],
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('empty state', () => {
    it('should render filter description when no conditions', () => {
      renderWithProviders(<ConditionBuilder {...defaultProps} />);

      expect(screen.getByText('Filter (optional)')).toBeInTheDocument();
      expect(
        screen.getByText(/Add conditions to control exactly when this automation runs/),
      ).toBeInTheDocument();
    });

    it('should show "Add custom condition" button in empty state', () => {
      renderWithProviders(<ConditionBuilder {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Add custom condition/i })).toBeInTheDocument();
    });

    it('should show quick-add presets for push event', () => {
      renderWithProviders(<ConditionBuilder {...defaultProps} />);

      expect(screen.getByText('Quick add')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Branch is/ })).toBeInTheDocument();
    });

    it('should show label preset for issues.labeled event', () => {
      renderWithProviders(
        <ConditionBuilder {...defaultProps} selectedEvents={['issues.labeled']} />,
      );

      expect(screen.getByRole('button', { name: /Label is/ })).toBeInTheDocument();
    });

    it('should show pull request presets', () => {
      renderWithProviders(
        <ConditionBuilder {...defaultProps} selectedEvents={['pull_request.opened']} />,
      );

      expect(screen.getByRole('button', { name: /Target branch/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Not draft/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Author is/ })).toBeInTheDocument();
    });

    it('should show workflow_run presets', () => {
      renderWithProviders(
        <ConditionBuilder {...defaultProps} selectedEvents={['workflow_run.completed']} />,
      );

      expect(screen.getByRole('button', { name: /Workflow name/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Conclusion is/ })).toBeInTheDocument();
    });
  });

  describe('adding conditions', () => {
    it('should add a custom condition when clicking "Add custom condition"', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      renderWithProviders(<ConditionBuilder {...defaultProps} onChange={onChange} />);

      await user.click(screen.getByRole('button', { name: /Add custom condition/i }));

      expect(onChange).toHaveBeenCalledWith([
        { conditions: [{ path: '', operator: 'equals', value: '' }] },
      ]);
    });

    it('should add a preset condition when clicking a preset', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      renderWithProviders(<ConditionBuilder {...defaultProps} onChange={onChange} />);

      await user.click(screen.getByRole('button', { name: /Branch is/ }));

      expect(onChange).toHaveBeenCalledWith([
        {
          conditions: [{ path: 'ref', operator: 'equals', value: 'refs/heads/main' }],
        },
      ]);
    });

    it('should append preset to existing group', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      const existingGroups: ConditionGroup[] = [
        { conditions: [{ path: 'ref', operator: 'equals', value: 'refs/heads/main' }] },
      ];

      renderWithProviders(
        <ConditionBuilder
          {...defaultProps}
          conditionGroups={existingGroups}
          selectedEvents={['push', 'issues.labeled']}
          onChange={onChange}
        />,
      );

      await user.click(screen.getByRole('button', { name: /Label is/ }));

      expect(onChange).toHaveBeenCalledWith([
        {
          conditions: [
            { path: 'ref', operator: 'equals', value: 'refs/heads/main' },
            { path: 'label.name', operator: 'equals', value: '' },
          ],
        },
      ]);
    });
  });

  describe('condition display', () => {
    it('should show condition rows with path, operator, and value', () => {
      const groups: ConditionGroup[] = [
        { conditions: [{ path: 'ref', operator: 'equals', value: 'refs/heads/main' }] },
      ];

      renderWithProviders(<ConditionBuilder {...defaultProps} conditionGroups={groups} />);

      expect(screen.getByText('Conditions')).toBeInTheDocument();
      expect(screen.getByDisplayValue('refs/heads/main')).toBeInTheDocument();
    });

    it('should show AND separator between conditions in a group', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [
            { path: 'ref', operator: 'equals', value: 'refs/heads/main' },
            { path: 'pusher.name', operator: 'equals', value: 'bot' },
          ],
        },
      ];

      renderWithProviders(<ConditionBuilder {...defaultProps} conditionGroups={groups} />);

      expect(screen.getByText('and')).toBeInTheDocument();
    });

    it('should show OR separator between groups', () => {
      const groups: ConditionGroup[] = [
        { conditions: [{ path: 'ref', operator: 'equals', value: 'refs/heads/main' }] },
        { conditions: [{ path: 'ref', operator: 'starts_with', value: 'refs/heads/release/' }] },
      ];

      renderWithProviders(<ConditionBuilder {...defaultProps} conditionGroups={groups} />);

      expect(screen.getByText('or')).toBeInTheDocument();
    });

    it('should hide value input for exists operator', () => {
      const groups: ConditionGroup[] = [
        { conditions: [{ path: 'issue.pull_request', operator: 'exists' }] },
      ];

      renderWithProviders(<ConditionBuilder {...defaultProps} conditionGroups={groups} />);

      // Should not have a value input for this condition
      expect(screen.queryByPlaceholderText('Value')).not.toBeInTheDocument();
    });

    it('should hide value input for not_exists operator', () => {
      const groups: ConditionGroup[] = [
        { conditions: [{ path: 'issue.pull_request', operator: 'not_exists' }] },
      ];

      renderWithProviders(<ConditionBuilder {...defaultProps} conditionGroups={groups} />);

      expect(screen.queryByPlaceholderText('Value')).not.toBeInTheDocument();
    });
  });

  describe('removing conditions', () => {
    it('should remove a condition when clicking remove button', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      const groups: ConditionGroup[] = [
        {
          conditions: [
            { path: 'ref', operator: 'equals', value: 'refs/heads/main' },
            { path: 'pusher.name', operator: 'equals', value: 'bot' },
          ],
        },
      ];

      renderWithProviders(
        <ConditionBuilder {...defaultProps} conditionGroups={groups} onChange={onChange} />,
      );

      const removeButtons = screen.getAllByRole('button', { name: 'Remove condition' });
      await user.click(removeButtons[0]!);

      expect(onChange).toHaveBeenCalledWith([
        { conditions: [{ path: 'pusher.name', operator: 'equals', value: 'bot' }] },
      ]);
    });

    it('should remove entire group when last condition is removed', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      const groups: ConditionGroup[] = [
        { conditions: [{ path: 'ref', operator: 'equals', value: 'refs/heads/main' }] },
      ];

      renderWithProviders(
        <ConditionBuilder {...defaultProps} conditionGroups={groups} onChange={onChange} />,
      );

      await user.click(screen.getByRole('button', { name: 'Remove condition' }));

      expect(onChange).toHaveBeenCalledWith([]);
    });
  });

  describe('adding groups', () => {
    it('should show "Add OR group" button when conditions exist', () => {
      const groups: ConditionGroup[] = [
        { conditions: [{ path: 'ref', operator: 'equals', value: 'main' }] },
      ];

      renderWithProviders(<ConditionBuilder {...defaultProps} conditionGroups={groups} />);

      expect(screen.getByRole('button', { name: /Add OR group/i })).toBeInTheDocument();
    });

    it('should add a new OR group when clicking "Add OR group"', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      const groups: ConditionGroup[] = [
        { conditions: [{ path: 'ref', operator: 'equals', value: 'main' }] },
      ];

      renderWithProviders(
        <ConditionBuilder {...defaultProps} conditionGroups={groups} onChange={onChange} />,
      );

      await user.click(screen.getByRole('button', { name: /Add OR group/i }));

      expect(onChange).toHaveBeenCalledWith([
        { conditions: [{ path: 'ref', operator: 'equals', value: 'main' }] },
        { conditions: [{ path: '', operator: 'equals', value: '' }] },
      ]);
    });
  });

  describe('adding conditions within a group', () => {
    it('should add condition to group when clicking "Add condition"', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      const groups: ConditionGroup[] = [
        { conditions: [{ path: 'ref', operator: 'equals', value: 'main' }] },
      ];

      renderWithProviders(
        <ConditionBuilder {...defaultProps} conditionGroups={groups} onChange={onChange} />,
      );

      await user.click(screen.getByRole('button', { name: /^Add condition$/i }));

      expect(onChange).toHaveBeenCalledWith([
        {
          conditions: [
            { path: 'ref', operator: 'equals', value: 'main' },
            { path: '', operator: 'equals', value: '' },
          ],
        },
      ]);
    });
  });

  describe('editing conditions', () => {
    it('should call onChange with updated value when typing a character', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      const groups: ConditionGroup[] = [
        { conditions: [{ path: 'ref', operator: 'equals', value: '' }] },
      ];

      renderWithProviders(
        <ConditionBuilder {...defaultProps} conditionGroups={groups} onChange={onChange} />,
      );

      const valueInput = screen.getByPlaceholderText('Value');
      await user.type(valueInput, 'a');

      expect(onChange).toHaveBeenCalledWith([
        { conditions: [{ path: 'ref', operator: 'equals', value: 'a' }] },
      ]);
    });
  });

  describe('condition preview', () => {
    it('should show natural language preview', () => {
      const groups: ConditionGroup[] = [
        { conditions: [{ path: 'ref', operator: 'equals', value: 'refs/heads/main' }] },
      ];

      renderWithProviders(<ConditionBuilder {...defaultProps} conditionGroups={groups} />);

      const preview = screen.getByTestId('condition-preview');
      expect(preview).toBeInTheDocument();
      expect(within(preview).getByText('Runs when')).toBeInTheDocument();
      expect(within(preview).getByText('ref')).toBeInTheDocument();
      expect(within(preview).getByText('equals')).toBeInTheDocument();
    });

    it('should show OR and AND in preview for multiple groups', () => {
      const groups: ConditionGroup[] = [
        {
          conditions: [
            { path: 'ref', operator: 'equals', value: 'refs/heads/main' },
            { path: 'forced', operator: 'equals', value: 'false' },
          ],
        },
        { conditions: [{ path: 'ref', operator: 'starts_with', value: 'refs/heads/release/' }] },
      ];

      renderWithProviders(<ConditionBuilder {...defaultProps} conditionGroups={groups} />);

      const preview = screen.getByTestId('condition-preview');
      expect(within(preview).getByText('AND')).toBeInTheDocument();
      expect(within(preview).getByText('OR')).toBeInTheDocument();
    });

    it('should not show preview when no conditions', () => {
      renderWithProviders(<ConditionBuilder {...defaultProps} />);

      expect(screen.queryByTestId('condition-preview')).not.toBeInTheDocument();
    });
  });

  describe('group removal', () => {
    it('should show group remove buttons when multiple groups exist', () => {
      const groups: ConditionGroup[] = [
        { conditions: [{ path: 'ref', operator: 'equals', value: 'main' }] },
        { conditions: [{ path: 'ref', operator: 'starts_with', value: 'release/' }] },
      ];

      renderWithProviders(<ConditionBuilder {...defaultProps} conditionGroups={groups} />);

      expect(screen.getByRole('button', { name: 'Remove group 1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove group 2' })).toBeInTheDocument();
    });

    it('should remove a group when clicking remove group button', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      const groups: ConditionGroup[] = [
        { conditions: [{ path: 'ref', operator: 'equals', value: 'main' }] },
        { conditions: [{ path: 'ref', operator: 'starts_with', value: 'release/' }] },
      ];

      renderWithProviders(
        <ConditionBuilder {...defaultProps} conditionGroups={groups} onChange={onChange} />,
      );

      await user.click(screen.getByRole('button', { name: 'Remove group 1' }));

      expect(onChange).toHaveBeenCalledWith([
        { conditions: [{ path: 'ref', operator: 'starts_with', value: 'release/' }] },
      ]);
    });
  });
});
