/**
 * Canonical workflow template content for the Codaholiq GitHub Actions workflow.
 * Source of truth: .github/workflows/codaholiq.yml
 *
 * Unified multi-provider template — a single workflow file with conditional
 * steps that route to the correct AI coding agent based on the `provider` input.
 *
 * Used by:
 * - WorkflowTemplateController (GET /workflow-template)
 * - RepositoriesService (setupWorkflowPR — creates PR with this content)
 */
export const WORKFLOW_TEMPLATE = `name: Codaholiq

on:
  workflow_dispatch:
    inputs:
      prompt:
        description: 'The prompt to send to the AI coding agent'
        required: true
        type: string
      provider:
        description: 'The AI provider to use'
        required: true
        type: string
        default: 'claude-code'
      model:
        description: 'The model to use (format depends on provider)'
        required: false
        type: string
        default: ''

permissions:
  contents: write
  pull-requests: write
  issues: write
  actions: read
  security-events: read
  id-token: write

jobs:
  execute:
    runs-on: ubuntu-latest
    steps:
      - name: Validate provider input
        run: |
          KNOWN="claude-code opencode codex gemini"
          if ! echo "$KNOWN" | grep -qw "$PROVIDER"; then
            echo "::error::Unknown provider: $PROVIDER (expected one of: $KNOWN)"
            exit 1
          fi
        env:
          PROVIDER: \${{ github.event.inputs.provider }}

      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        if: hashFiles('package.json') != ''
        uses: actions/setup-node@v4
        with:
          node-version: lts/*

      - name: Install dependencies
        if: hashFiles('package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb') != ''
        shell: bash
        run: |
          if [ -f "pnpm-lock.yaml" ]; then
            npm install -g pnpm && pnpm install --frozen-lockfile
          elif [ -f "yarn.lock" ]; then
            corepack enable && yarn install --frozen-lockfile
          elif [ -f "bun.lockb" ]; then
            npm install -g bun && bun install --frozen-lockfile
          elif [ -f "package-lock.json" ]; then
            npm ci
          fi

      # --- Claude Code ---
      - name: Run Claude Code
        if: github.event.inputs.provider == 'claude-code'
        uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: \${{ secrets.ANTHROPIC_API_KEY }}
          claude_code_oauth_token: \${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          prompt: \${{ github.event.inputs.prompt }}
          allowed_bots: 'codaholiq'
          claude_args: >-
            --allowedTools "Bash" "Read" "Edit" "Write" "Glob" "Grep" "WebFetch" "Task"
            \${{ github.event.inputs.model != '' && format('--model "{0}"', github.event.inputs.model) || '' }}

      # --- OpenAI Codex ---
      - name: Run OpenAI Codex
        if: github.event.inputs.provider == 'codex'
        uses: openai/codex-action@v1
        with:
          openai-api-key: \${{ secrets.OPENAI_API_KEY }}
          prompt: \${{ github.event.inputs.prompt }}
          model: \${{ github.event.inputs.model }}
          sandbox: 'workspace-write'

      # --- Gemini CLI ---
      - name: Run Gemini CLI
        if: github.event.inputs.provider == 'gemini'
        uses: google-github-actions/run-gemini-cli@v0
        with:
          gemini_api_key: \${{ secrets.GEMINI_API_KEY }}
          prompt: \${{ github.event.inputs.prompt }}
          gemini_model: \${{ github.event.inputs.model }}

      # --- OpenCode ---
      - name: Run OpenCode
        if: github.event.inputs.provider == 'opencode'
        uses: anomalyco/opencode/github@latest
        with:
          model: \${{ github.event.inputs.model }}
          prompt: \${{ github.event.inputs.prompt }}
          use_github_token: true
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
          OPENAI_API_KEY: \${{ secrets.OPENAI_API_KEY }}
          GEMINI_API_KEY: \${{ secrets.GEMINI_API_KEY }}
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`;
