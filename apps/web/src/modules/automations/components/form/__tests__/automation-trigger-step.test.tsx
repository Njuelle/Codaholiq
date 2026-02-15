import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { Form } from '@/common/components/ui/form';
import type { AutomationFormValues } from '@/modules/automations/lib/automation-schemas';
import { DEFAULT_FORM_VALUES } from '@/modules/automations/lib/automation-schemas';
import { renderWithProviders } from '@/test/test-utils';
import { AutomationTriggerStep } from '../automation-trigger-step';
import type { ReactElement } from 'react';

vi.mock('@/modules/automations/hooks/use-github-events', () => ({
  useGitHubEvents: vi.fn().mockReturnValue({
    categories: [
      { id: 'code_and_commits', label: 'Code & Commits' },
      { id: 'pull_requests', label: 'Pull Requests' },
    ],
    events: [
      {
        event: 'push',
        description: 'One or more commits pushed',
        category: 'code_and_commits',
        actions: [],
        payloadPaths: [{ path: 'ref', description: 'Branch ref' }],
      },
      {
        event: 'pull_request',
        description: 'Pull request activity',
        category: 'pull_requests',
        actions: [
          { name: 'opened', description: 'PR opened' },
          { name: 'closed', description: 'PR closed' },
        ],
        payloadPaths: [{ path: 'pull_request.base.ref', description: 'Target branch' }],
      },
    ],
    isLoading: false,
  }),
  getPayloadPathsForEvents: vi.fn().mockReturnValue([]),
}));

function TestWrapper({
  defaultValues,
  children,
}: {
  defaultValues?: Partial<AutomationFormValues>;
  children: (form: ReturnType<typeof useForm<AutomationFormValues>>) => ReactElement;
}): ReactElement {
  const form = useForm<AutomationFormValues>({
    defaultValues: { ...DEFAULT_FORM_VALUES, ...defaultValues } as AutomationFormValues,
  });
  return <Form {...form}>{children(form)}</Form>;
}

function renderTriggerStep(defaultValues?: Partial<AutomationFormValues>): void {
  renderWithProviders(
    <TestWrapper defaultValues={defaultValues}>
      {(form) => (
        <AutomationTriggerStep control={form.control} watch={form.watch} setValue={form.setValue} />
      )}
    </TestWrapper>,
  );
}

describe('AutomationTriggerStep', () => {
  it('should render trigger type radio buttons', () => {
    renderTriggerStep();

    expect(screen.getByLabelText('Event')).toBeInTheDocument();
    expect(screen.getByLabelText('Cron')).toBeInTheDocument();
    expect(screen.getByLabelText('Manual')).toBeInTheDocument();
  });

  it('should render the trigger type label', () => {
    renderTriggerStep();

    expect(screen.getByText('Trigger Type')).toBeInTheDocument();
    expect(screen.getByText('Choose how this automation is triggered.')).toBeInTheDocument();
  });

  describe('Event trigger type', () => {
    it('should show event picker when Event is selected', () => {
      renderTriggerStep({ triggerType: 'event', triggerConfig: { events: [] } });

      expect(screen.getByText('GitHub Events')).toBeInTheDocument();
      expect(
        screen.getByText('Select which GitHub events should trigger this automation.'),
      ).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search events...')).toBeInTheDocument();
    });

    it('should show categorized events in accordion', () => {
      renderTriggerStep({ triggerType: 'event', triggerConfig: { events: [] } });

      expect(screen.getByText('Code & Commits')).toBeInTheDocument();
      expect(screen.getByText('Pull Requests')).toBeInTheDocument();
    });

    it('should select an event via checkbox', async () => {
      const user = userEvent.setup();
      renderTriggerStep({ triggerType: 'event', triggerConfig: { events: [] } });

      // Expand the Code & Commits category
      await user.click(screen.getByText('Code & Commits'));

      // Click the push checkbox
      await waitFor(() => {
        expect(screen.getByLabelText('push')).toBeInTheDocument();
      });
      await user.click(screen.getByLabelText('push'));

      await waitFor(() => {
        expect(screen.getByText('Selected (1)')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: 'Remove push' })).toBeInTheDocument();
    });

    it('should deselect an event via checkbox', async () => {
      const user = userEvent.setup();
      renderTriggerStep({
        triggerType: 'event',
        triggerConfig: { events: ['push'] },
      });

      expect(screen.getByText('Selected (1)')).toBeInTheDocument();

      // Expand and click the checkbox again to deselect
      await user.click(screen.getByText('Code & Commits'));
      await waitFor(() => {
        expect(screen.getByLabelText('push')).toBeInTheDocument();
      });
      await user.click(screen.getByLabelText('push'));

      await waitFor(() => {
        expect(screen.queryByText('Selected (1)')).not.toBeInTheDocument();
      });
    });

    it('should remove an event via the remove badge button', async () => {
      const user = userEvent.setup();
      renderTriggerStep({
        triggerType: 'event',
        triggerConfig: { events: ['push', 'pull_request.opened'] },
      });

      expect(screen.getByText('Selected (2)')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Remove push' }));

      await waitFor(() => {
        expect(screen.getByText('Selected (1)')).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: 'Remove push' })).not.toBeInTheDocument();
    });

    it('should show event config by default since DEFAULT_FORM_VALUES has event trigger type', () => {
      renderTriggerStep();

      expect(screen.getByText('GitHub Events')).toBeInTheDocument();
    });

    it('should not show condition builder when no events selected', () => {
      renderTriggerStep({
        triggerType: 'event',
        triggerConfig: { events: [], conditionGroups: [] },
      });

      expect(screen.queryByText('Filter (optional)')).not.toBeInTheDocument();
    });

    it('should show condition builder when events are selected', () => {
      renderTriggerStep({
        triggerType: 'event',
        triggerConfig: { events: ['push'], conditionGroups: [] },
      });

      expect(screen.getByText('Filter (optional)')).toBeInTheDocument();
    });

    it('should filter events by search', async () => {
      const user = userEvent.setup();
      renderTriggerStep({ triggerType: 'event', triggerConfig: { events: [] } });

      const searchInput = screen.getByPlaceholderText('Search events...');
      await user.type(searchInput, 'pull');

      await waitFor(() => {
        expect(screen.getByText('Pull Requests')).toBeInTheDocument();
        expect(screen.queryByText('Code & Commits')).not.toBeInTheDocument();
      });
    });
  });

  describe('Cron trigger type', () => {
    it('should show cron schedule input when Cron is selected', () => {
      renderTriggerStep({
        triggerType: 'cron',
        triggerConfig: { schedule: '', timezone: undefined },
      });

      expect(screen.getByText('Cron Schedule')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('0 * * * *')).toBeInTheDocument();
    });

    it('should show cron presets', () => {
      renderTriggerStep({
        triggerType: 'cron',
        triggerConfig: { schedule: '', timezone: undefined },
      });

      expect(screen.getByText('Presets')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Every hour' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Daily at 9am' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Weekly Monday' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Weekdays 9am' })).toBeInTheDocument();
    });

    it('should apply a preset when clicking a preset button', async () => {
      const user = userEvent.setup();
      renderTriggerStep({
        triggerType: 'cron',
        triggerConfig: { schedule: '', timezone: undefined },
      });

      await user.click(screen.getByRole('button', { name: 'Every hour' }));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('0 * * * *')).toHaveValue('0 * * * *');
      });
    });

    it('should show timezone input', () => {
      renderTriggerStep({
        triggerType: 'cron',
        triggerConfig: { schedule: '', timezone: undefined },
      });

      expect(screen.getByText('Timezone')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('e.g. America/New_York')).toBeInTheDocument();
      expect(screen.getByText('Optional. Defaults to UTC if not specified.')).toBeInTheDocument();
    });

    it('should display human-readable cron description when schedule is entered', () => {
      renderTriggerStep({
        triggerType: 'cron',
        triggerConfig: { schedule: '0 9 * * 1-5', timezone: undefined },
      });

      expect(screen.getByText(/At 09:00 AM, Monday through Friday/i)).toBeInTheDocument();
    });
  });

  describe('Manual trigger type', () => {
    it('should show manual trigger info text when Manual is selected', () => {
      renderTriggerStep({
        triggerType: 'manual',
        triggerConfig: {},
      });

      expect(screen.getByText('Manual Trigger')).toBeInTheDocument();
      expect(
        screen.getByText('This automation can only be triggered manually from the dashboard.'),
      ).toBeInTheDocument();
    });

    it('should not show event or cron config when Manual is selected', () => {
      renderTriggerStep({
        triggerType: 'manual',
        triggerConfig: {},
      });

      expect(screen.queryByText('GitHub Events')).not.toBeInTheDocument();
      expect(screen.queryByText('Cron Schedule')).not.toBeInTheDocument();
    });
  });

  describe('switching trigger types', () => {
    it('should switch from Event to Cron config when Cron radio is clicked', async () => {
      const user = userEvent.setup();
      renderTriggerStep({ triggerType: 'event', triggerConfig: { events: [] } });

      expect(screen.getByText('GitHub Events')).toBeInTheDocument();

      await user.click(screen.getByLabelText('Cron'));

      await waitFor(() => {
        expect(screen.getByText('Cron Schedule')).toBeInTheDocument();
      });
      expect(screen.queryByText('GitHub Events')).not.toBeInTheDocument();
    });

    it('should switch from Event to Manual config when Manual radio is clicked', async () => {
      const user = userEvent.setup();
      renderTriggerStep({ triggerType: 'event', triggerConfig: { events: [] } });

      await user.click(screen.getByLabelText('Manual'));

      await waitFor(() => {
        expect(screen.getByText('Manual Trigger')).toBeInTheDocument();
      });
      expect(screen.queryByText('GitHub Events')).not.toBeInTheDocument();
    });
  });
});
