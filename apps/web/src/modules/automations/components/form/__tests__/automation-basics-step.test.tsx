import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { http, HttpResponse } from 'msw';
import { Form } from '@/common/components/ui/form';
import type { AutomationFormValues } from '@/modules/automations/lib/automation-schemas';
import { DEFAULT_FORM_VALUES } from '@/modules/automations/lib/automation-schemas';
import { renderWithProviders } from '@/test/test-utils';
import { server } from '@/test/msw-server';
import { mockRepo } from '@/test/factories';
import { AutomationBasicsStep } from '../automation-basics-step';
import type { ReactElement } from 'react';

function TestWrapper({
  defaultValues,
  orgId,
}: {
  defaultValues?: Partial<AutomationFormValues>;
  orgId: number;
}): ReactElement {
  const form = useForm<AutomationFormValues>({
    defaultValues: { ...DEFAULT_FORM_VALUES, ...defaultValues } as AutomationFormValues,
  });
  return (
    <Form {...form}>
      <AutomationBasicsStep
        control={form.control}
        watch={form.watch}
        setValue={form.setValue}
        orgId={orgId}
      />
    </Form>
  );
}

function renderBasicsStep(defaultValues?: Partial<AutomationFormValues>, orgId = 1): void {
  renderWithProviders(<TestWrapper defaultValues={defaultValues} orgId={orgId} />);
}

describe('AutomationBasicsStep', () => {
  it('should render name input, description textarea, and repo select', async () => {
    renderBasicsStep();

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Auto-review PRs')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Optional description of what this automation does...'),
    ).toBeInTheDocument();
    expect(screen.getByText('Repository')).toBeInTheDocument();

    // Wait for repos to load
    await screen.findByText('Select a repository');
  });

  it('should display pre-filled name and description', () => {
    renderBasicsStep({
      name: 'My Automation',
      description: 'Does cool stuff',
    });

    expect(screen.getByDisplayValue('My Automation')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Does cool stuff')).toBeInTheDocument();
  });

  it('should show "Loading repositories..." while repos are loading', () => {
    server.use(
      http.get('/api/orgs/:orgId/repos', () => {
        return new Promise(() => {
          // Never resolves — keeps loading state
        });
      }),
    );

    renderBasicsStep();

    expect(screen.getByText('Loading repositories...')).toBeInTheDocument();
  });

  it('should enable select and show placeholder after repos load', async () => {
    renderBasicsStep();

    // Wait for repos to load and the select to become enabled
    await waitFor(() => {
      const trigger = screen.getByRole('combobox');
      expect(trigger).toBeEnabled();
    });

    expect(screen.getByText('Select a repository')).toBeInTheDocument();
  });

  it('should disable select while repos are loading', () => {
    server.use(
      http.get('/api/orgs/:orgId/repos', () => {
        return new Promise(() => {
          // Never resolves — keeps loading state
        });
      }),
    );

    renderBasicsStep();

    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeDisabled();
  });

  it('should allow typing in the name input', async () => {
    const user = userEvent.setup();
    renderBasicsStep();

    const nameInput = screen.getByPlaceholderText('e.g. Auto-review PRs');
    await user.type(nameInput, 'New Automation');

    expect(nameInput).toHaveValue('New Automation');
  });

  it('should allow typing in the description textarea', async () => {
    const user = userEvent.setup();
    renderBasicsStep();

    const descriptionTextarea = screen.getByPlaceholderText(
      'Optional description of what this automation does...',
    );
    await user.type(descriptionTextarea, 'Runs lint on every push');

    expect(descriptionTextarea).toHaveValue('Runs lint on every push');
  });

  it('should render form descriptions', () => {
    renderBasicsStep();

    expect(screen.getByText('A descriptive name for this automation.')).toBeInTheDocument();
    expect(screen.getByText('The GitHub repository this automation targets.')).toBeInTheDocument();
  });

  it('should auto-select the repository when there is only one', async () => {
    server.use(
      http.get('/api/orgs/:orgId/repos', () => {
        return HttpResponse.json({
          data: {
            items: [mockRepo({ id: 42, name: 'only-repo', fullName: 'test-org/only-repo' })],
            meta: { total: 1, limit: 100, offset: 0 },
          },
          requestId: 'test-request-id',
        });
      }),
    );

    renderBasicsStep();

    await waitFor(() => {
      expect(screen.getByText('test-org/only-repo')).toBeInTheDocument();
    });
  });

  it('should not auto-select when there are multiple repositories', async () => {
    renderBasicsStep();

    await waitFor(() => {
      const trigger = screen.getByRole('combobox');
      expect(trigger).toBeEnabled();
    });

    expect(screen.getByText('Select a repository')).toBeInTheDocument();
  });
});
