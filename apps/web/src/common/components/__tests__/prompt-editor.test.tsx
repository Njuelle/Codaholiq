import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { PromptEditor, type PromptEditorRef } from '../prompt-editor';

describe('PromptEditor', () => {
  it('should render the textarea', () => {
    render(<PromptEditor value="" onChange={vi.fn()} />);

    expect(screen.getByRole('textbox', { name: 'Prompt template editor' })).toBeInTheDocument();
  });

  it('should display the value', () => {
    render(<PromptEditor value="Fix all lint errors" onChange={vi.fn()} />);

    expect(screen.getByDisplayValue('Fix all lint errors')).toBeInTheDocument();
  });

  it('should call onChange when user types', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PromptEditor value="" onChange={onChange} />);

    const textarea = screen.getByRole('textbox', { name: 'Prompt template editor' });
    await user.type(textarea, 'hello');

    expect(onChange).toHaveBeenCalled();
  });

  it('should show placeholder when empty', () => {
    render(<PromptEditor value="" onChange={vi.fn()} />);

    expect(
      screen.getByPlaceholderText(/Write the instructions that Claude Code will follow/),
    ).toBeInTheDocument();
  });

  describe('insertText via ref', () => {
    function getTextarea(): HTMLTextAreaElement {
      return screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Prompt template editor' });
    }

    it('should insert text at cursor position and call onChange', () => {
      const onChange = vi.fn();
      const ref = createRef<PromptEditorRef>();
      render(<PromptEditor ref={ref} value="hello world" onChange={onChange} />);

      const textarea = getTextarea();
      // Simulate cursor at position 5 (between "hello" and " world")
      textarea.selectionStart = 5;
      textarea.selectionEnd = 5;

      ref.current?.insertText(' {{repo.name}}');

      expect(onChange).toHaveBeenCalledWith('hello {{repo.name}} world');
    });

    it('should replace selected text when inserting', () => {
      const onChange = vi.fn();
      const ref = createRef<PromptEditorRef>();
      render(<PromptEditor ref={ref} value="hello world" onChange={onChange} />);

      const textarea = getTextarea();
      // Select "world"
      textarea.selectionStart = 6;
      textarea.selectionEnd = 11;

      ref.current?.insertText('{{pr.title}}');

      expect(onChange).toHaveBeenCalledWith('hello {{pr.title}}');
    });

    it('should insert at beginning when cursor is at start', () => {
      const onChange = vi.fn();
      const ref = createRef<PromptEditorRef>();
      render(<PromptEditor ref={ref} value="existing text" onChange={onChange} />);

      const textarea = getTextarea();
      textarea.selectionStart = 0;
      textarea.selectionEnd = 0;

      ref.current?.insertText('{{timestamp}} ');

      expect(onChange).toHaveBeenCalledWith('{{timestamp}} existing text');
    });
  });
});
