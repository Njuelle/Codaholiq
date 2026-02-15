import { renderHook, waitFor, act } from '@testing-library/react';
import { useSSE } from '../use-sse';

function createSSEStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < events.length) {
        controller.enqueue(encoder.encode(`data: ${events[index]}\n\n`));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

describe('useSSE', () => {
  it('should not connect when disabled', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    renderHook(() => useSSE({ url: '/test/stream', enabled: false }));

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('should connect and receive events', async () => {
    const events = [JSON.stringify({ message: 'hello' }), JSON.stringify({ message: 'world' })];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(createSSEStream(events), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );

    const { result } = renderHook(() => useSSE<{ message: string }>({ url: '/test/stream' }));

    await waitFor(() => {
      expect(result.current.events).toHaveLength(2);
    });

    expect(result.current.events[0]).toEqual({ message: 'hello' });
    expect(result.current.events[1]).toEqual({ message: 'world' });
    expect(result.current.data).toEqual({ message: 'world' });

    vi.restoreAllMocks();
  });

  it('should call onMessage callback for each event', async () => {
    const events = [JSON.stringify({ id: 1 })];
    const onMessage = vi.fn();

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(createSSEStream(events), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );

    renderHook(() =>
      useSSE<{ id: number }>({
        url: '/test/stream',
        onMessage,
      }),
    );

    await waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith({ id: 1 });
    });

    vi.restoreAllMocks();
  });

  it('should close connection on unmount', () => {
    const abortSpy = vi.fn();
    vi.spyOn(globalThis, 'AbortController').mockReturnValue({
      signal: {
        aborted: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as unknown as AbortSignal,
      abort: abortSpy,
    } as unknown as AbortController);

    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    const { unmount } = renderHook(() => useSSE({ url: '/test/stream' }));

    act(() => {
      unmount();
    });

    expect(abortSpy).toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});
