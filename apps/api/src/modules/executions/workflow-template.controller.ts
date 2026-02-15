import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';

const WORKFLOW_TEMPLATE = `# .github/workflows/codaholiq.yml
name: Codaholiq

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

@Controller()
export class WorkflowTemplateController {
  @Public()
  @Get('workflow-template')
  getWorkflowTemplate(): { template: string } {
    return { template: WORKFLOW_TEMPLATE };
  }
}
