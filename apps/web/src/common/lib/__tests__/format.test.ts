import {
  formatDuration,
  computeDurationMs,
  formatRelativeTime,
  formatCost,
  formatTokens,
} from '../format';

describe('formatDuration', () => {
  it('should return "-" for zero or negative', () => {
    expect(formatDuration(0)).toBe('-');
    expect(formatDuration(-100)).toBe('-');
  });

  it('should return "< 1s" for sub-second durations', () => {
    expect(formatDuration(500)).toBe('< 1s');
    expect(formatDuration(999)).toBe('< 1s');
  });

  it('should format seconds only', () => {
    expect(formatDuration(1000)).toBe('1s');
    expect(formatDuration(45000)).toBe('45s');
  });

  it('should format minutes and seconds', () => {
    expect(formatDuration(60_000)).toBe('1m');
    expect(formatDuration(154_000)).toBe('2m 34s');
  });

  it('should format hours and minutes', () => {
    expect(formatDuration(3_600_000)).toBe('1h');
    expect(formatDuration(4_320_000)).toBe('1h 12m');
  });

  it('should omit zero trailing units', () => {
    expect(formatDuration(7_200_000)).toBe('2h');
    expect(formatDuration(120_000)).toBe('2m');
  });
});

describe('computeDurationMs', () => {
  it('should return null if startedAt is null', () => {
    expect(
      computeDurationMs({ startedAt: null, completedAt: '2025-01-01T00:01:00.000Z' }),
    ).toBeNull();
  });

  it('should return null if completedAt is null', () => {
    expect(
      computeDurationMs({ startedAt: '2025-01-01T00:00:00.000Z', completedAt: null }),
    ).toBeNull();
  });

  it('should compute duration in milliseconds', () => {
    expect(
      computeDurationMs({
        startedAt: '2025-01-01T00:00:00.000Z',
        completedAt: '2025-01-01T00:02:34.000Z',
      }),
    ).toBe(154_000);
  });
});

describe('formatRelativeTime', () => {
  it('should return "just now" for recent timestamps', () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe('just now');
  });

  it('should return minutes ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveMinAgo)).toBe('5m ago');
  });

  it('should return hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago');
  });

  it('should return "yesterday" for 1 day ago', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(yesterday)).toBe('yesterday');
  });

  it('should return days ago for recent dates', () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveDaysAgo)).toBe('5d ago');
  });

  it('should return "just now" for future timestamps', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(formatRelativeTime(future)).toBe('just now');
  });
});

describe('formatCost', () => {
  it('should format zero', () => {
    expect(formatCost(0)).toBe('$0.00');
  });

  it('should format sub-cent values', () => {
    expect(formatCost(4200)).toBe('< $0.01');
    expect(formatCost(1)).toBe('< $0.01');
    expect(formatCost(9999)).toBe('< $0.01');
  });

  it('should format fractional dollar values', () => {
    expect(formatCost(100_000)).toBe('$0.10');
    expect(formatCost(500_000)).toBe('$0.50');
    expect(formatCost(42_000)).toBe('$0.042');
  });

  it('should format whole dollar amounts', () => {
    expect(formatCost(1_000_000)).toBe('$1.00');
    expect(formatCost(1_230_000)).toBe('$1.23');
    expect(formatCost(99_990_000)).toBe('$99.99');
  });

  it('should treat negative values as zero', () => {
    expect(formatCost(-1)).toBe('$0.00');
    expect(formatCost(-500_000)).toBe('$0.00');
  });
});

describe('formatTokens', () => {
  it('should format small counts', () => {
    expect(formatTokens(0)).toBe('0');
    expect(formatTokens(999)).toBe('999');
  });

  it('should format thousands', () => {
    expect(formatTokens(1_000)).toBe('1.0K');
    expect(formatTokens(12_500)).toBe('12.5K');
    expect(formatTokens(999_999)).toBe('1000.0K');
  });

  it('should format millions', () => {
    expect(formatTokens(1_000_000)).toBe('1.0M');
    expect(formatTokens(5_500_000)).toBe('5.5M');
  });
});
