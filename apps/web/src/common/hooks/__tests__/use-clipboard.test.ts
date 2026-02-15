import { renderHook, act } from '@testing-library/react';
import { useClipboard } from '../use-clipboard';

describe('useClipboard', () => {
  const mockWriteText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: mockWriteText },
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    mockWriteText.mockClear();
  });

  it('should start with isCopied false', () => {
    const { result } = renderHook(() => useClipboard());
    expect(result.current.isCopied).toBe(false);
  });

  it('should copy text and set isCopied', async () => {
    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      await result.current.copy('hello');
    });

    expect(mockWriteText).toHaveBeenCalledWith('hello');
    expect(result.current.isCopied).toBe(true);
  });

  it('should reset isCopied after timeout', async () => {
    const { result } = renderHook(() => useClipboard({ timeout: 1000 }));

    await act(async () => {
      await result.current.copy('test');
    });

    expect(result.current.isCopied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.isCopied).toBe(false);
  });
});
