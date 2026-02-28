export interface ExtractedCost {
  readonly totalCostMicros: number | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
}

interface LogEntry {
  readonly message: string;
}

/**
 * Provider-specific regex patterns for extracting cost data from workflow logs.
 *
 * Each provider entry contains:
 * - `cost`: patterns to match total cost in dollars (capture group 1 = dollar amount)
 * - `inputTokens`: patterns to match input token count (capture group 1 = number)
 * - `outputTokens`: patterns to match output token count (capture group 1 = number)
 *
 * Patterns are tried against every log line. The LAST match wins (cost summaries
 * typically appear at the end of the log output).
 *
 * Numbers may contain commas or K/M suffixes (e.g., "20.3K" = 20,300).
 */
const PROVIDER_PATTERNS: Record<
  string,
  {
    cost: RegExp[];
    inputTokens: RegExp[];
    outputTokens: RegExp[];
  }
> = {
  'claude-code': {
    cost: [
      // CLI /cost output: "Total cost:            $0.55"
      /Total cost:\s+\$([\d,]+(?:\.\d+)?)/,
      // JSON --output-format json: "total_cost_usd": 0.0034
      /"total_cost_usd":\s*([\d.]+)/,
      // JSON legacy: "totalCost": 0.42
      /"totalCost":\s*([\d.]+)/,
    ],
    inputTokens: [
      // JSON camelCase: "inputTokens": 12345
      /"inputTokens":\s*([\d,]+)/,
      // JSON snake_case: "input_tokens": 12345
      /"input_tokens":\s*([\d,]+)/,
      // Text: "Input tokens: 12,345"
      /[Ii]nput tokens?:\s*([\d,]+)/,
    ],
    outputTokens: [
      // JSON camelCase: "outputTokens": 6789
      /"outputTokens":\s*([\d,]+)/,
      // JSON snake_case: "output_tokens": 6789
      /"output_tokens":\s*([\d,]+)/,
      // Text: "Output tokens: 6,789"
      /[Oo]utput tokens?:\s*([\d,]+)/,
    ],
  },

  codex: {
    cost: [
      // Codex CLI /cost output: "Total cost: $0.1524"
      /Total cost:\s*\$([\d,]+(?:\.\d+)?)/,
      // Session JSON: "totalCostUSD": 0.15
      /"totalCostUSD":\s*([\d.]+)/,
    ],
    inputTokens: [
      // JSON turn event: "input_tokens": 26549
      /"input_tokens":\s*([\d,]+)/,
    ],
    outputTokens: [
      // JSON turn event: "output_tokens": 1590
      /"output_tokens":\s*([\d,]+)/,
    ],
  },

  opencode: {
    cost: [
      // Exit summary: "Total Cost:          $0.1234"
      /Total Cost:\s+\$([\d,]+(?:\.\d+)?)/,
    ],
    inputTokens: [
      // Exit summary: "  Input Tokens:      20.3K" or "  Input Tokens:      534" or "  Input Tokens:      1.5M"
      /Input Tokens:\s+([\d,.]+[KkMm]?)/,
    ],
    outputTokens: [
      // Exit summary: "  Output Tokens:     534" or "  Output Tokens:     1.2K" or "  Output Tokens:     2.0M"
      /Output Tokens:\s+([\d,.]+[KkMm]?)/,
    ],
  },

  gemini: {
    cost: [],
    inputTokens: [
      // JSON stats: "prompt": 24939
      /"prompt":\s*([\d,]+)/,
      // Table row: "gemini-2.5-pro     2       22,062          76"
      // Captures 3rd column (input tokens)
      /gemini-\S+\s+\d+\s+([\d,]+)\s+[\d,]+/,
    ],
    outputTokens: [
      // JSON stats: "candidates": 20
      /"candidates":\s*([\d,]+)/,
      // Table row: "gemini-2.5-pro     2       22,062          76"
      // Captures 4th column (output tokens)
      /gemini-\S+\s+\d+\s+[\d,]+\s+([\d,]+)/,
    ],
  },
};

/**
 * Parses a numeric string that may contain commas or a K/M suffix.
 * Examples: "12345" -> 12345, "12,345" -> 12345, "20.3K" -> 20300, "1.5M" -> 1500000
 */
function parseNumber(raw: string): number {
  const cleaned = raw.replace(/,/g, '');

  if (/[Kk]$/.test(cleaned)) {
    return Math.round(Number(cleaned.slice(0, -1)) * 1_000);
  }
  if (/[Mm]$/.test(cleaned)) {
    return Math.round(Number(cleaned.slice(0, -1)) * 1_000_000);
  }

  return Number(cleaned);
}

function dollarToMicros(dollars: number): number {
  return Math.round(dollars * 1_000_000);
}

/**
 * Extracts cost and token data from workflow log entries using provider-specific patterns.
 *
 * Returns an object with whatever data was found (cost and/or tokens).
 * Returns null if the provider has no patterns or nothing was matched.
 *
 * Some providers (e.g., Gemini) don't output dollar costs but do output token counts.
 * In those cases, `totalCostMicros` will be null while tokens are populated.
 */
export function extractCostFromLogs({
  provider,
  logEntries,
}: {
  provider: string;
  logEntries: readonly LogEntry[];
}): ExtractedCost | null {
  const patterns = PROVIDER_PATTERNS[provider];
  if (!patterns) {
    return null;
  }

  let costDollars: number | null = null;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;

  for (const entry of logEntries) {
    const line = entry.message;

    for (const pattern of patterns.cost) {
      const match = pattern.exec(line);
      if (match?.[1]) {
        const parsed = parseNumber(match[1]);
        if (Number.isFinite(parsed) && parsed >= 0) {
          costDollars = parsed;
        }
      }
    }

    for (const pattern of patterns.inputTokens) {
      const match = pattern.exec(line);
      if (match?.[1]) {
        const parsed = parseNumber(match[1]);
        if (Number.isFinite(parsed) && parsed >= 0) {
          inputTokens = parsed;
        }
      }
    }

    for (const pattern of patterns.outputTokens) {
      const match = pattern.exec(line);
      if (match?.[1]) {
        const parsed = parseNumber(match[1]);
        if (Number.isFinite(parsed) && parsed >= 0) {
          outputTokens = parsed;
        }
      }
    }
  }

  const hasCost = costDollars !== null && costDollars > 0;
  const hasTokens = inputTokens !== null || outputTokens !== null;

  if (!hasCost && !hasTokens) {
    return null;
  }

  return {
    totalCostMicros: costDollars !== null && costDollars > 0 ? dollarToMicros(costDollars) : null,
    inputTokens,
    outputTokens,
  };
}
