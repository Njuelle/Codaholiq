import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { mockSharedVariable, mockRepo } from '@/test/factories';
import { SharedVariableDialog } from '../shared-variable-dialog';

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('SharedVariableDialog', () => {
  const repos = [
    mockRepo({ id: 10, fullName: 'acme/web-app' }),
    mockRepo({ id: 20, fullName: 'acme/api' }),
  ];

  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    variable: null,
    repos,
    onSubmit: vi.fn(),
    isSubmitting: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create mode', () => {
    it('should render Add Variable title', () => {
      renderWithProviders(<SharedVariableDialog {...defaultProps} />);

      expect(screen.getByText('Add Variable')).toBeInTheDocument();
    });

    it('should render all form fields', () => {
      renderWithProviders(<SharedVariableDialog {...defaultProps} />);

      expect(screen.getByLabelText('Key')).toBeInTheDocument();
      expect(screen.getByLabelText('Value')).toBeInTheDocument();
      expect(screen.getByLabelText('Description (optional)')).toBeInTheDocument();
      expect(screen.getByLabelText('Scope')).toBeInTheDocument();
    });

    it('should have empty fields in create mode', () => {
      renderWithProviders(<SharedVariableDialog {...defaultProps} />);

      expect(screen.getByLabelText('Key')).toHaveValue('');
      expect(screen.getByLabelText('Value')).toHaveValue('');
      expect(screen.getByLabelText('Description (optional)')).toHaveValue('');
    });

    it('should render Create button', () => {
      renderWithProviders(<SharedVariableDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
    });

    it('should call onSubmit with org-wide scope by default', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SharedVariableDialog {...defaultProps} />);

      await user.type(screen.getByLabelText('Key'), 'MY_VAR');
      await user.type(screen.getByLabelText('Value'), 'my-value');
      await user.click(screen.getByRole('button', { name: 'Create' }));

      expect(defaultProps.onSubmit).toHaveBeenCalledWith({
        key: 'MY_VAR',
        value: 'my-value',
        description: undefined,
        repoId: undefined,
      });
    });

    it('should call onSubmit with description when provided', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SharedVariableDialog {...defaultProps} />);

      await user.type(screen.getByLabelText('Key'), 'API_KEY');
      await user.type(screen.getByLabelText('Value'), 'abc123');
      await user.type(screen.getByLabelText('Description (optional)'), 'An API key');
      await user.click(screen.getByRole('button', { name: 'Create' }));

      expect(defaultProps.onSubmit).toHaveBeenCalledWith({
        key: 'API_KEY',
        value: 'abc123',
        description: 'An API key',
        repoId: undefined,
      });
    });

    it('should have key field enabled in create mode', () => {
      renderWithProviders(<SharedVariableDialog {...defaultProps} />);

      expect(screen.getByLabelText('Key')).toBeEnabled();
    });

    it('should render Cancel button', () => {
      renderWithProviders(<SharedVariableDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('should call onOpenChange(false) on Cancel click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SharedVariableDialog {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    });

    it('should disable submit button when isSubmitting', () => {
      renderWithProviders(<SharedVariableDialog {...defaultProps} isSubmitting={true} />);

      expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
    });
  });

  describe('edit mode', () => {
    const editVariable = mockSharedVariable({
      id: 5,
      key: 'EXISTING_KEY',
      value: 'existing-value',
      description: 'Existing description',
      repoId: null,
    });

    it('should render Edit Variable title', () => {
      renderWithProviders(<SharedVariableDialog {...defaultProps} variable={editVariable} />);

      expect(screen.getByText('Edit Variable')).toBeInTheDocument();
    });

    it('should render Save button', () => {
      renderWithProviders(<SharedVariableDialog {...defaultProps} variable={editVariable} />);

      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    it('should pre-populate fields with variable data', () => {
      renderWithProviders(<SharedVariableDialog {...defaultProps} variable={editVariable} />);

      expect(screen.getByLabelText('Key')).toHaveValue('EXISTING_KEY');
      expect(screen.getByLabelText('Value')).toHaveValue('existing-value');
      expect(screen.getByLabelText('Description (optional)')).toHaveValue('Existing description');
    });

    it('should have key field disabled in edit mode', () => {
      renderWithProviders(<SharedVariableDialog {...defaultProps} variable={editVariable} />);

      expect(screen.getByLabelText('Key')).toBeDisabled();
    });
  });

  describe('not rendered when closed', () => {
    it('should not render content when closed', () => {
      renderWithProviders(<SharedVariableDialog {...defaultProps} open={false} />);

      expect(screen.queryByText('Add Variable')).not.toBeInTheDocument();
    });
  });
});
