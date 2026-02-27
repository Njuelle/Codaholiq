import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, type UseFormWatch } from 'react-hook-form';
import { Form } from '@/common/components/ui/form';
import type { AutomationFormValues } from '@/modules/automations/lib/automation-schemas';
import { DEFAULT_FORM_VALUES } from '@/modules/automations/lib/automation-schemas';
import { renderWithProviders } from '@/test/test-utils';
import { ProviderModelSelector } from '../provider-model-selector';
import type { ReactElement } from 'react';

// Radix Select polyfills for jsdom
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

function FormValuesSpy({ watch }: { watch: UseFormWatch<AutomationFormValues> }): ReactElement {
  const model = watch('model');
  const provider = watch('provider');
  return <div data-testid="form-values" data-model={model ?? ''} data-provider={provider} />;
}

function TestWrapper({
  defaultValues,
  children,
  showSpy,
}: {
  defaultValues?: Partial<AutomationFormValues>;
  children: (form: ReturnType<typeof useForm<AutomationFormValues>>) => ReactElement;
  showSpy?: boolean;
}): ReactElement {
  const form = useForm<AutomationFormValues>({
    defaultValues: { ...DEFAULT_FORM_VALUES, ...defaultValues } as AutomationFormValues,
  });
  return (
    <Form {...form}>
      {children(form)}
      {showSpy && <FormValuesSpy watch={form.watch} />}
    </Form>
  );
}

function renderSelector(defaultValues?: Partial<AutomationFormValues>, showSpy?: boolean) {
  return renderWithProviders(
    <TestWrapper defaultValues={defaultValues} showSpy={showSpy}>
      {(form) => (
        <ProviderModelSelector control={form.control} watch={form.watch} setValue={form.setValue} />
      )}
    </TestWrapper>,
  );
}

describe('ProviderModelSelector', () => {
  it('should render provider and model labels', async () => {
    renderSelector();

    await waitFor(() => {
      expect(screen.getByText('Provider')).toBeInTheDocument();
    });
    expect(screen.getByText('Model')).toBeInTheDocument();
  });

  it('should show default provider after data loads', async () => {
    renderSelector();

    await waitFor(() => {
      expect(screen.getByText('Claude Code')).toBeInTheDocument();
    });
  });

  it('should show default model label when model is null', async () => {
    renderSelector();

    await waitFor(() => {
      expect(screen.getByText(/Default/)).toBeInTheDocument();
    });
  });

  it('should show description text for provider and model fields', async () => {
    renderSelector();

    await waitFor(() => {
      expect(
        screen.getByText('The AI coding agent to use for this automation.'),
      ).toBeInTheDocument();
    });
    expect(screen.getByText('Select the model to use for this automation.')).toBeInTheDocument();
  });

  it('should render two combobox triggers', async () => {
    renderSelector();

    await waitFor(() => {
      const comboboxes = screen.getAllByRole('combobox');
      expect(comboboxes).toHaveLength(2);
    });
  });

  it('should reset model to null when provider changes', async () => {
    const user = userEvent.setup();

    renderSelector({ provider: 'claude-code', model: 'claude-opus-4-6' }, true);

    // Wait for providers to load
    await waitFor(() => {
      expect(screen.getByText('Claude Code')).toBeInTheDocument();
    });

    // Verify initial model is set via spy element
    const spy = screen.getByTestId('form-values');
    expect(spy).toHaveAttribute('data-model', 'claude-opus-4-6');

    // Open the provider select and change to Codex
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes[0]).toBeDefined();
    await user.click(comboboxes[0]!);

    const codexOption = await screen.findByRole('option', { name: 'OpenAI Codex' });
    await user.click(codexOption);

    // Model should be reset to null (empty string in data attribute) after provider change
    await waitFor(() => {
      expect(screen.getByTestId('form-values')).toHaveAttribute('data-model', '');
    });
  });
});
