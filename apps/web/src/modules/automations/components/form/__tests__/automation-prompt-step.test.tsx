import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { Form } from '@/common/components/ui/form';
import type { AutomationFormValues } from '@/modules/automations/lib/automation-schemas';
import { DEFAULT_FORM_VALUES } from '@/modules/automations/lib/automation-schemas';
import { renderWithProviders } from '@/test/test-utils';
import { AutomationPromptStep } from '../automation-prompt-step';
import type { ReactElement } from 'react';

const { mockInsertText } = vi.hoisted(() => {
  const mockInsertText = vi.fn();
  return { mockInsertText };
});

vi.mock('@/common/components/prompt-editor', async () => {
  const React = await import('react');
  const MockPromptEditor = React.forwardRef(function MockPromptEditor(
    { value, onChange }: { value: string; onChange: (v: string) => void },
    ref: React.Ref<{ insertText: (text: string) => void }>,
  ) {
    React.useImperativeHandle(ref, () => ({ insertText: mockInsertText }), []);
    return (
      <textarea
        aria-label="Prompt template editor"
        value={value}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
          onChange(e.target.value);
        }}
        placeholder="Write the instructions that Claude Code will follow when this automation runs..."
      />
    );
  });
  return { PromptEditor: MockPromptEditor };
});

const mockEvents = vi.hoisted(() => [
  {
    event: 'push',
    description: 'One or more commits pushed',
    category: 'code_and_commits',
    actions: [],
    payloadPaths: [
      { path: 'ref', description: 'Branch or tag ref' },
      { path: 'pusher.name', description: 'Username of the pusher' },
    ],
  },
  {
    event: 'pull_request',
    description: 'Pull request activity',
    category: 'pull_requests',
    hasEntityBuiltIns: true,
    actions: [{ name: 'opened', description: 'Pull request opened' }],
    payloadPaths: [
      { path: 'pull_request.base.ref', description: 'Target branch name' },
      { path: 'pull_request.head.ref', description: 'Source branch name' },
      { path: 'pull_request.title', description: 'PR title' },
      { path: 'pull_request.user.login', description: 'PR author username' },
    ],
  },
  {
    event: 'issues',
    description: 'Issue activity',
    category: 'issues',
    hasEntityBuiltIns: true,
    actions: [{ name: 'opened', description: 'Issue opened' }],
    payloadPaths: [
      { path: 'issue.title', description: 'Issue title' },
      { path: 'issue.user.login', description: 'Issue author username' },
    ],
  },
]);

vi.mock('@/modules/automations/hooks/use-github-events', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/modules/automations/hooks/use-github-events')>();
  return {
    ...actual,
    useGitHubEvents: () => ({
      categories: [],
      events: mockEvents,
      isLoading: false,
    }),
  };
});

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

function renderPromptStep(defaultValues?: Partial<AutomationFormValues>): void {
  renderWithProviders(
    <TestWrapper defaultValues={defaultValues}>
      {(form) => <AutomationPromptStep control={form.control} watch={form.watch} />}
    </TestWrapper>,
  );
}

describe('AutomationPromptStep', () => {
  beforeEach(() => {
    mockInsertText.mockClear();
  });

  describe('prompt template', () => {
    it('should render the prompt template editor', () => {
      renderPromptStep();

      expect(screen.getByText('Prompt Template')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Prompt template editor' })).toBeInTheDocument();
    });

    it('should display pre-filled prompt template text', () => {
      renderPromptStep({ promptTemplate: 'Fix all lint errors in the repository' });

      expect(screen.getByDisplayValue('Fix all lint errors in the repository')).toBeInTheDocument();
    });

    it('should render the variable syntax description', () => {
      renderPromptStep();

      expect(screen.getByText(/syntax to reference dynamic values/)).toBeInTheDocument();
    });

    it('should allow typing in the prompt template editor', async () => {
      const user = userEvent.setup();
      renderPromptStep();

      const editor = screen.getByRole('textbox', { name: 'Prompt template editor' });

      await user.type(editor, 'Run tests for');

      await waitFor(() => {
        expect(editor).toHaveValue('Run tests for');
      });
    });
  });

  describe('variable groups — event trigger', () => {
    it('should render General and Event Info groups when event trigger with no events', () => {
      renderPromptStep({
        triggerType: 'event',
        triggerConfig: { events: [] },
      });

      expect(screen.getByText('Insert Variables')).toBeInTheDocument();
      expect(screen.getByText('General')).toBeInTheDocument();
      expect(screen.getByText('Event Info')).toBeInTheDocument();
    });

    it('should show general variables (timestamp, automation.name)', () => {
      renderPromptStep({
        triggerType: 'event',
        triggerConfig: { events: [] },
      });

      expect(screen.getByRole('button', { name: '{{timestamp}}' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '{{automation.name}}' })).toBeInTheDocument();
    });

    it('should show event info variables', () => {
      renderPromptStep({
        triggerType: 'event',
        triggerConfig: { events: [] },
      });

      expect(screen.getByRole('button', { name: '{{event.type}}' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '{{event.action}}' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '{{event.repo}}' })).toBeInTheDocument();
    });

    it('should show PR / Issue entity variables when PR events selected', () => {
      renderPromptStep({
        triggerType: 'event',
        triggerConfig: { events: ['pull_request.opened'] },
      });

      expect(screen.getByText('PR / Issue')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '{{event.title}}' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '{{event.number}}' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '{{event.body}}' })).toBeInTheDocument();
    });

    it('should show PR / Issue entity variables when issue events selected', () => {
      renderPromptStep({
        triggerType: 'event',
        triggerConfig: { events: ['issues.opened'] },
      });

      expect(screen.getByText('PR / Issue')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '{{event.title}}' })).toBeInTheDocument();
    });

    it('should not show PR / Issue group for push events', () => {
      renderPromptStep({
        triggerType: 'event',
        triggerConfig: { events: ['push'] },
      });

      expect(screen.queryByText('PR / Issue')).not.toBeInTheDocument();
    });

    it('should show payload path variables for PR events', () => {
      renderPromptStep({
        triggerType: 'event',
        triggerConfig: { events: ['pull_request.opened'] },
      });

      expect(screen.getByText('Event Payload')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '{{pull_request.base.ref}}' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '{{pull_request.head.ref}}' })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: '{{pull_request.user.login}}' }),
      ).toBeInTheDocument();
    });

    it('should filter out overlapping payload paths (pull_request.title covered by event.title)', () => {
      renderPromptStep({
        triggerType: 'event',
        triggerConfig: { events: ['pull_request.opened'] },
      });

      // pull_request.title is covered by event.title built-in
      expect(
        screen.queryByRole('button', { name: '{{pull_request.title}}' }),
      ).not.toBeInTheDocument();
    });

    it('should show push payload paths', () => {
      renderPromptStep({
        triggerType: 'event',
        triggerConfig: { events: ['push'] },
      });

      expect(screen.getByText('Event Payload')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '{{ref}}' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '{{pusher.name}}' })).toBeInTheDocument();
    });
  });

  describe('variable groups — cron trigger', () => {
    it('should show only General group', () => {
      renderPromptStep({
        triggerType: 'cron',
        triggerConfig: { schedule: '0 9 * * 1-5' },
      });

      expect(screen.getByText('General')).toBeInTheDocument();
      expect(screen.queryByText('Event Info')).not.toBeInTheDocument();
      expect(screen.queryByText('Repository')).not.toBeInTheDocument();
    });

    it('should show timestamp and automation.name', () => {
      renderPromptStep({
        triggerType: 'cron',
        triggerConfig: { schedule: '0 9 * * 1-5' },
      });

      expect(screen.getByRole('button', { name: '{{timestamp}}' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '{{automation.name}}' })).toBeInTheDocument();
    });
  });

  describe('variable groups — manual trigger', () => {
    it('should show General and Repository groups', () => {
      renderPromptStep({
        triggerType: 'manual',
        triggerConfig: {},
      });

      expect(screen.getByText('General')).toBeInTheDocument();
      expect(screen.getByText('Repository')).toBeInTheDocument();
      expect(screen.queryByText('Event Info')).not.toBeInTheDocument();
    });

    it('should show repo variables', () => {
      renderPromptStep({
        triggerType: 'manual',
        triggerConfig: {},
      });

      expect(screen.getByRole('button', { name: '{{repo.owner}}' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '{{repo.name}}' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '{{repo.full_name}}' })).toBeInTheDocument();
    });
  });

  describe('variable insertion', () => {
    it('should call insertText with template syntax when a variable button is clicked', async () => {
      const user = userEvent.setup();
      renderPromptStep({
        triggerType: 'event',
        triggerConfig: { events: [] },
      });

      await user.click(screen.getByRole('button', { name: '{{timestamp}}' }));

      expect(mockInsertText).toHaveBeenCalledWith('{{timestamp}}');
    });

    it('should call insertText for payload path variables', async () => {
      const user = userEvent.setup();
      renderPromptStep({
        triggerType: 'event',
        triggerConfig: { events: ['push'] },
      });

      await user.click(screen.getByRole('button', { name: '{{ref}}' }));

      expect(mockInsertText).toHaveBeenCalledWith('{{ref}}');
    });
  });

  describe('no custom variables section', () => {
    it('should not render Add Variable button', () => {
      renderPromptStep();

      expect(screen.queryByRole('button', { name: /Add Variable/ })).not.toBeInTheDocument();
    });

    it('should not render variable definition fields', () => {
      renderPromptStep();

      expect(screen.queryByPlaceholderText('VAR_NAME')).not.toBeInTheDocument();
      expect(
        screen.queryByText('Define variables that can be used in the prompt template.'),
      ).not.toBeInTheDocument();
    });
  });
});
