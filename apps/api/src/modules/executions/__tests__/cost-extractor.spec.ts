import { extractCostFromLogs } from '../cost-extractor';

function makeEntries(lines: string[]): { message: string }[] {
  return lines.map((message) => ({ message }));
}

describe('extractCostFromLogs', () => {
  describe('claude-code provider', () => {
    it('should extract cost from CLI /cost output', () => {
      const logEntries = makeEntries([
        'Some initial log line',
        'Running Claude Code...',
        'Total cost:            $0.55',
        'Total duration (API):  6m 19.7s',
      ]);

      const result = extractCostFromLogs({ provider: 'claude-code', logEntries });

      expect(result).toEqual({
        totalCostMicros: 550_000,
        inputTokens: null,
        outputTokens: null,
      });
    });

    it('should extract cost from total_cost_usd JSON field', () => {
      const logEntries = makeEntries([
        '{"type":"result","total_cost_usd":0.0034,"is_error":false}',
      ]);

      const result = extractCostFromLogs({ provider: 'claude-code', logEntries });

      expect(result).toEqual({
        totalCostMicros: 3_400,
        inputTokens: null,
        outputTokens: null,
      });
    });

    it('should extract cost and tokens from JSON-style output', () => {
      const logEntries = makeEntries([
        '{"inputTokens": 12345, "outputTokens": 6789, "totalCost": 0.42}',
      ]);

      const result = extractCostFromLogs({ provider: 'claude-code', logEntries });

      expect(result).toEqual({
        totalCostMicros: 420_000,
        inputTokens: 12345,
        outputTokens: 6789,
      });
    });

    it('should extract tokens from snake_case JSON fields', () => {
      const logEntries = makeEntries([
        '{"input_tokens": 5000, "output_tokens": 1200}',
        'Total cost:            $0.10',
      ]);

      const result = extractCostFromLogs({ provider: 'claude-code', logEntries });

      expect(result).toEqual({
        totalCostMicros: 100_000,
        inputTokens: 5000,
        outputTokens: 1200,
      });
    });

    it('should extract tokens from text-style output', () => {
      const logEntries = makeEntries([
        'Input tokens: 10,000',
        'Output tokens: 5,000',
        'Total cost:            $1.23',
      ]);

      const result = extractCostFromLogs({ provider: 'claude-code', logEntries });

      expect(result).toEqual({
        totalCostMicros: 1_230_000,
        inputTokens: 10_000,
        outputTokens: 5_000,
      });
    });

    it('should handle large dollar amounts', () => {
      const logEntries = makeEntries(['Total cost:            $12.50']);

      const result = extractCostFromLogs({ provider: 'claude-code', logEntries });

      expect(result).toEqual({
        totalCostMicros: 12_500_000,
        inputTokens: null,
        outputTokens: null,
      });
    });

    it('should handle sub-cent amounts', () => {
      const logEntries = makeEntries(['Total cost:            $0.003']);

      const result = extractCostFromLogs({ provider: 'claude-code', logEntries });

      expect(result).toEqual({
        totalCostMicros: 3_000,
        inputTokens: null,
        outputTokens: null,
      });
    });

    it('should use last match when multiple cost lines appear', () => {
      const logEntries = makeEntries([
        'Total cost:            $0.10',
        'Some other output...',
        'Total cost:            $0.55',
      ]);

      const result = extractCostFromLogs({ provider: 'claude-code', logEntries });

      expect(result).toEqual({
        totalCostMicros: 550_000,
        inputTokens: null,
        outputTokens: null,
      });
    });

    it('should return null when cost is zero and no tokens found', () => {
      const logEntries = makeEntries(['Total cost:            $0.00']);

      const result = extractCostFromLogs({ provider: 'claude-code', logEntries });

      expect(result).toBeNull();
    });

    it('should return null when no cost pattern matches', () => {
      const logEntries = makeEntries(['Some log output without cost data', 'Another line']);

      const result = extractCostFromLogs({ provider: 'claude-code', logEntries });

      expect(result).toBeNull();
    });

    it('should return null for empty log entries', () => {
      const result = extractCostFromLogs({ provider: 'claude-code', logEntries: [] });

      expect(result).toBeNull();
    });

    it('should handle comma-separated token numbers', () => {
      const logEntries = makeEntries([
        '"inputTokens": 1,234,567',
        '"outputTokens": 890,123',
        'Total cost:            $5.00',
      ]);

      const result = extractCostFromLogs({ provider: 'claude-code', logEntries });

      expect(result).toEqual({
        totalCostMicros: 5_000_000,
        inputTokens: 1_234_567,
        outputTokens: 890_123,
      });
    });
  });

  describe('codex provider', () => {
    it('should extract cost from /cost output', () => {
      const logEntries = makeEntries(['⎿ Total cost: $0.1524', '⎿ Total duration (API): 23.7s']);

      const result = extractCostFromLogs({ provider: 'codex', logEntries });

      expect(result).toEqual({
        totalCostMicros: 152_400,
        inputTokens: null,
        outputTokens: null,
      });
    });

    it('should extract cost from totalCostUSD JSON field', () => {
      const logEntries = makeEntries(['"totalCostUSD": 0.85']);

      const result = extractCostFromLogs({ provider: 'codex', logEntries });

      expect(result).toEqual({
        totalCostMicros: 850_000,
        inputTokens: null,
        outputTokens: null,
      });
    });

    it('should extract tokens from turn.completed JSON events', () => {
      const logEntries = makeEntries([
        '{"type":"turn.completed","usage":{"input_tokens":26549,"output_tokens":1590}}',
        'Total cost: $0.15',
      ]);

      const result = extractCostFromLogs({ provider: 'codex', logEntries });

      expect(result).toEqual({
        totalCostMicros: 150_000,
        inputTokens: 26549,
        outputTokens: 1590,
      });
    });

    it('should use last token values from multiple turn events', () => {
      const logEntries = makeEntries([
        '{"usage":{"input_tokens":5000,"output_tokens":200}}',
        '{"usage":{"input_tokens":15000,"output_tokens":800}}',
        'Total cost: $0.30',
      ]);

      const result = extractCostFromLogs({ provider: 'codex', logEntries });

      expect(result).toEqual({
        totalCostMicros: 300_000,
        inputTokens: 15000,
        outputTokens: 800,
      });
    });

    it('should return null when no patterns match', () => {
      const logEntries = makeEntries(['Running codex...', 'Done.']);

      const result = extractCostFromLogs({ provider: 'codex', logEntries });

      expect(result).toBeNull();
    });
  });

  describe('opencode provider', () => {
    it('should extract cost and tokens from exit summary', () => {
      const logEntries = makeEntries([
        'Agent powering down. Goodbye!',
        'Total Cost:          $0.1234',
        '  Input Tokens:      20.3K',
        '  Output Tokens:     534',
      ]);

      const result = extractCostFromLogs({ provider: 'opencode', logEntries });

      expect(result).toEqual({
        totalCostMicros: 123_400,
        inputTokens: 20_300,
        outputTokens: 534,
      });
    });

    it('should handle K suffix for output tokens', () => {
      const logEntries = makeEntries([
        'Total Cost:          $0.50',
        '  Input Tokens:      100.5K',
        '  Output Tokens:     2.5K',
      ]);

      const result = extractCostFromLogs({ provider: 'opencode', logEntries });

      expect(result).toEqual({
        totalCostMicros: 500_000,
        inputTokens: 100_500,
        outputTokens: 2_500,
      });
    });

    it('should handle zero cost with tokens present', () => {
      const logEntries = makeEntries([
        'Total Cost:          $0.0000',
        '  Input Tokens:      5.2K',
        '  Output Tokens:     300',
      ]);

      const result = extractCostFromLogs({ provider: 'opencode', logEntries });

      expect(result).toEqual({
        totalCostMicros: null,
        inputTokens: 5_200,
        outputTokens: 300,
      });
    });

    it('should return null when no patterns match', () => {
      const logEntries = makeEntries(['Starting opencode...', 'Processing...']);

      const result = extractCostFromLogs({ provider: 'opencode', logEntries });

      expect(result).toBeNull();
    });
  });

  describe('gemini provider', () => {
    it('should extract tokens from JSON stats output', () => {
      const logEntries = makeEntries(['{"tokens":{"prompt":24939,"candidates":20,"total":25113}}']);

      const result = extractCostFromLogs({ provider: 'gemini', logEntries });

      expect(result).toEqual({
        totalCostMicros: null,
        inputTokens: 24939,
        outputTokens: 20,
      });
    });

    it('should extract tokens from model usage table row', () => {
      const logEntries = makeEntries([
        'Model                Reqs    Input Tokens    Output Tokens',
        '---------------------------------------------------------------',
        'gemini-2.5-pro     2       22,062          76',
      ]);

      const result = extractCostFromLogs({ provider: 'gemini', logEntries });

      expect(result).toEqual({
        totalCostMicros: null,
        inputTokens: 22_062,
        outputTokens: 76,
      });
    });

    it('should extract from gemini-flash model row', () => {
      const logEntries = makeEntries(['gemini-2.5-flash     5       150,000          8,500']);

      const result = extractCostFromLogs({ provider: 'gemini', logEntries });

      expect(result).toEqual({
        totalCostMicros: null,
        inputTokens: 150_000,
        outputTokens: 8_500,
      });
    });

    it('should return null with no dollar cost (tokens-only provider)', () => {
      const logEntries = makeEntries(['{"tokens":{"prompt":10000,"candidates":500}}']);

      const result = extractCostFromLogs({ provider: 'gemini', logEntries });

      expect(result?.totalCostMicros).toBeNull();
      expect(result?.inputTokens).toBe(10000);
      expect(result?.outputTokens).toBe(500);
    });

    it('should return null when no patterns match', () => {
      const logEntries = makeEntries(['Running Gemini CLI...', 'Done.']);

      const result = extractCostFromLogs({ provider: 'gemini', logEntries });

      expect(result).toBeNull();
    });
  });

  describe('unknown provider', () => {
    it('should return null for unknown providers', () => {
      const logEntries = makeEntries(['Total cost:            $0.55']);

      const result = extractCostFromLogs({ provider: 'unknown-provider', logEntries });

      expect(result).toBeNull();
    });
  });

  describe('parseNumber with suffixes', () => {
    it('should handle M suffix for large token counts', () => {
      const logEntries = makeEntries([
        '  Input Tokens:      1.5M',
        '  Output Tokens:     50K',
        'Total Cost:          $25.00',
      ]);

      const result = extractCostFromLogs({ provider: 'opencode', logEntries });

      expect(result).toEqual({
        totalCostMicros: 25_000_000,
        inputTokens: 1_500_000,
        outputTokens: 50_000,
      });
    });
  });
});
