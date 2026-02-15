import { useState, useCallback, useRef, useEffect } from 'react';

interface UseClipboardReturn {
  readonly isCopied: boolean;
  readonly copy: (text: string) => Promise<void>;
}

export function useClipboard({ timeout = 2000 }: { timeout?: number } = {}): UseClipboardReturn {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const copy = useCallback(
    async (text: string): Promise<void> => {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setIsCopied(false);
      }, timeout);
    },
    [timeout],
  );

  return { isCopied, copy };
}
