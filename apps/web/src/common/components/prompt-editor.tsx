import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';

export interface PromptEditorRef {
  insertText: (text: string) => void;
}

interface PromptEditorProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
}

export const PromptEditor = forwardRef<PromptEditorRef, PromptEditorProps>(function PromptEditor(
  { value, onChange },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      insertText(text: string): void {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = value.slice(0, start);
        const after = value.slice(end);
        const newValue = before + text + after;

        onChange(newValue);

        // Restore cursor position after the inserted text
        requestAnimationFrame(() => {
          const cursorPos = start + text.length;
          textarea.selectionStart = cursorPos;
          textarea.selectionEnd = cursorPos;
          textarea.focus();
        });
      },
    }),
    [value, onChange],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
      onChange(e.target.value);
    },
    [onChange],
  );

  return (
    <textarea
      ref={textareaRef}
      aria-label="Prompt template editor"
      className="border-input bg-muted/30 text-foreground h-[350px] w-full resize-y rounded-md border p-3 font-mono text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      placeholder="Write the instructions that Claude Code will follow when this automation runs..."
      value={value}
      onChange={handleChange}
    />
  );
});
