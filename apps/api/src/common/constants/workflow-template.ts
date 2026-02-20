/**
 * Canonical workflow template content for the Codaholiq GitHub Actions workflow.
 * Source of truth: .github/workflows/codaholiq.yml
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
        description: 'The prompt to send to Claude Code'
        required: true
        type: string
      model:
        description: 'The Claude model to use'
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
      - name: Validate model input
        if: github.event.inputs.model != ''
        run: |
          if [[ ! "$MODEL" =~ ^claude-[a-z0-9.-]+$ ]]; then
            echo "::error::Invalid model identifier: $MODEL"
            exit 1
          fi
        env:
          MODEL: \${{ github.event.inputs.model }}

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

      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: \${{ secrets.ANTHROPIC_API_KEY }}
          claude_code_oauth_token: \${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          prompt: \${{ github.event.inputs.prompt }}
          allowed_bots: 'codaholiq'
          claude_args: >-
            --allowedTools "Bash" "Read" "Edit" "Write" "Glob" "Grep" "WebFetch" "Task"
            \${{ github.event.inputs.model != '' && format('--model "{0}"', github.event.inputs.model) || '' }}
`;
