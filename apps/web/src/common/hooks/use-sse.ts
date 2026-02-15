import { useState, useEffect, useRef, useCallback } from 'react';
import { getAccessToken } from '@/common/lib/api-client';

interface UseSSEOptions<T> {
  readonly url: string;
  readonly enabled?: boolean;
  readonly onMessage?: (data: T) => void;
}

interface UseSSEReturn<T> {
  readonly data: T | null;
  readonly events: readonly T[];
  readonly isConnected: boolean;
  readonly error: Error | null;
  readonly close: () => void;
}

export function useSSE<T>({ url, enabled = true, onMessage }: UseSSEOptions<T>): UseSSEReturn<T> {
  const [events, setEvents] = useState<T[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async (): Promise<void> => {
      try {
        const token = getAccessToken();
        const headers: Record<string, string> = {
          Accept: 'text/event-stream',
        };
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(`/api${url}`, {
          headers,
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`SSE connection failed: ${response.status}`);
        }

        setIsConnected(true);
        setError(null);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const blocks = buffer.split('\n\n');
          buffer = blocks.pop() ?? '';

          for (const block of blocks) {
            const dataLine = block.split('\n').find((l) => l.startsWith('data: '));
            if (dataLine) {
              try {
                const parsed = JSON.parse(dataLine.slice(6)) as T;
                setEvents((prev) => [...prev, parsed]);
                onMessageRef.current?.(parsed);
              } catch {
                // Skip malformed events instead of crashing the stream
              }
            }
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const connectError = err instanceof Error ? err : new Error('SSE connection error');
        setError(connectError);
        // Auto-reconnect after 3 seconds
        reconnectTimer = setTimeout(() => {
          if (!controller.signal.aborted) void connect();
        }, 3000);
      } finally {
        if (!controller.signal.aborted) {
          setIsConnected(false);
        }
      }
    };

    void connect();

    return () => {
      controller.abort();
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      setIsConnected(false);
    };
  }, [url, enabled]);

  const data = events.length > 0 ? events[events.length - 1]! : null;

  const close = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return { data, events, isConnected, error, close };
}
