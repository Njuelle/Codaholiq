import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { Form } from '@/common/components/ui/form';
import type { AutomationFormValues } from '@/modules/automations/lib/automation-schemas';
import { DEFAULT_FORM_VALUES } from '@/modules/automations/lib/automation-schemas';
import { renderWithProviders } from '@/test/test-utils';
import { AutomationWorkflowStep } from '../automation-workflow-step';
import type { ReactElement } from 'react';

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

function renderWorkflowStep({
  defaultValues,
  onSubmit = vi.fn(),
  isSubmitting = false,
  mode = 'create',
}: {
  defaultValues?: Partial<AutomationFormValues>;
  onSubmit?: () => void;
  isSubmitting?: boolean;
  mode?: 'create' | 'edit';
} = {}): void {
  renderWithProviders(
    <TestWrapper defaultValues={defaultValues}>
      {(form) => (
        <AutomationWorkflowStep
          control={form.control}
          watch={form.watch}
          isSubmitting={isSubmitting}
          onSubmit={onSubmit}
          mode={mode}
        />
      )}
    </TestWrapper>,
  );
}

describe('AutomationWorkflowStep', () => {
  describe('enabled switch', () => {
    it('should render the enabled switch', () => {
      renderWorkflowStep();

      expect(screen.getByText('Enabled')).toBeInTheDocument();
      expect(
        screen.getByText('Enable this automation immediately after creation.'),
      ).toBeInTheDocument();
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('should have the switch checked by default', () => {
      renderWorkflowStep();

      expect(screen.getByRole('switch')).toBeChecked();
    });

    it('should toggle the switch off when clicked', async () => {
      const user = userEvent.setup();
      renderWorkflowStep();

      await user.click(screen.getByRole('switch'));

      await waitFor(() => {
        expect(screen.getByRole('switch')).not.toBeChecked();
      });
    });
  });

  describe('submit button', () => {
    it('should render "Create Automation" text in create mode', () => {
      renderWorkflowStep({ mode: 'create' });

      expect(screen.getByRole('button', { name: 'Create Automation' })).toBeInTheDocument();
    });

    it('should render "Save Changes" text in edit mode', () => {
      renderWorkflowStep({ mode: 'edit' });

      expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    });

    it('should call onSubmit when the submit button is clicked', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      renderWorkflowStep({ onSubmit, mode: 'create' });

      await user.click(screen.getByRole('button', { name: 'Create Automation' }));

      expect(onSubmit).toHaveBeenCalledOnce();
    });

    it('should disable the submit button when isSubmitting is true', () => {
      renderWorkflowStep({ isSubmitting: true, mode: 'create' });

      expect(screen.getByRole('button', { name: /Create Automation/ })).toBeDisabled();
    });

    it('should disable the submit button in edit mode when isSubmitting is true', () => {
      renderWorkflowStep({ isSubmitting: true, mode: 'edit' });

      expect(screen.getByRole('button', { name: /Save Changes/ })).toBeDisabled();
    });
  });

  describe('review summary', () => {
    it('should render the review summary card', () => {
      renderWorkflowStep();

      expect(screen.getByText('Review Summary')).toBeInTheDocument();
    });

    it('should display form values in the review summary', () => {
      renderWorkflowStep({
        defaultValues: {
          name: 'My Automation',
          triggerType: 'manual',
          triggerConfig: {},
          promptTemplate: 'Do something',
          variables: [],
        },
      });

      expect(screen.getByText('My Automation')).toBeInTheDocument();
      expect(screen.getByText('manual')).toBeInTheDocument();
      expect(screen.getByText('Triggered manually')).toBeInTheDocument();
      expect(screen.getByText('12 characters')).toBeInTheDocument();
    });

    it('should show event details in the review summary', () => {
      renderWorkflowStep({
        defaultValues: {
          triggerType: 'event',
          triggerConfig: { events: ['push', 'pull_request.opened'] },
        },
      });

      expect(screen.getByText('push, pull_request.opened')).toBeInTheDocument();
    });

    it('should show condition count when conditions exist', () => {
      renderWorkflowStep({
        defaultValues: {
          triggerType: 'event',
          triggerConfig: {
            events: ['push'],
            conditionGroups: [
              {
                conditions: [
                  { path: 'ref', operator: 'equals', value: 'refs/heads/main' },
                  { path: 'forced', operator: 'equals', value: 'false' },
                ],
              },
              {
                conditions: [
                  { path: 'ref', operator: 'starts_with', value: 'refs/heads/release/' },
                ],
              },
            ],
          },
        },
      });

      expect(screen.getByText('Conditions')).toBeInTheDocument();
      expect(screen.getByText('3 conditions in 2 groups')).toBeInTheDocument();
    });

    it('should not show condition count when no conditions', () => {
      renderWorkflowStep({
        defaultValues: {
          triggerType: 'event',
          triggerConfig: { events: ['push'], conditionGroups: [] },
        },
      });

      expect(screen.queryByText('Conditions')).not.toBeInTheDocument();
    });
  });

  describe('monthly cost limit', () => {
    it('renders monthly cost limit input', () => {
      renderWorkflowStep();

      expect(screen.getByText('Monthly Cost Limit (USD)')).toBeInTheDocument();
      expect(
        screen.getByText('Optional. Block new executions when monthly spend exceeds this amount.'),
      ).toBeInTheDocument();
      expect(screen.getByPlaceholderText('No limit')).toBeInTheDocument();
    });

    it('converts dollars to micros on input', async () => {
      const user = userEvent.setup();
      renderWorkflowStep();

      const input = screen.getByPlaceholderText('No limit');
      await user.type(input, '10.50');

      await waitFor(() => {
        expect(input).toHaveValue(10.5);
      });
    });

    it('displays existing micros value as dollars', () => {
      renderWorkflowStep({
        defaultValues: {
          monthlyCostLimitMicros: 5_000_000,
        },
      });

      const input = screen.getByPlaceholderText('No limit');
      expect(input).toHaveValue(5);
    });
  });
});
