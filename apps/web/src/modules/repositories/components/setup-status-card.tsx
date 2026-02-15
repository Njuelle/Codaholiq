import { Button } from '@/common/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card';
import { Skeleton } from '@/common/components/ui/skeleton';
import { useClipboard } from '@/common/hooks/use-clipboard';
import { CheckCircle2, AlertTriangle, Copy, Check } from 'lucide-react';
import type { ReactElement } from 'react';

const WORKFLOW_YAML = `name: Codaholiq
on:
  workflow_dispatch:
    inputs:
      prompt:
        description: 'The prompt to send to Claude Code'
        required: true
        type: string

jobs:
  codaholiq:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      issues: write
    steps:
      - uses: actions/checkout@v4
      - uses: anthropics/claude-code-action@v1
        with:
          prompt: \${{ inputs.prompt }}
          anthropic_api_key: \${{ secrets.ANTHROPIC_API_KEY }}`;

interface SetupStatusCardProps {
  readonly workflowFileExists: boolean | undefined;
  readonly isLoading: boolean;
  readonly isError: boolean;
}

export function SetupStatusCard({
  workflowFileExists,
  isLoading,
  isError,
}: SetupStatusCardProps): ReactElement {
  const { isCopied, copy } = useClipboard();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>GitHub Action Setup</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-48" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>GitHub Action Setup</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Unable to check setup status.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>GitHub Action Setup</CardTitle>
      </CardHeader>
      <CardContent>
        {workflowFileExists ? (
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium">Workflow file found</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm font-medium">Workflow file not found</span>
            </div>
            <p className="text-muted-foreground text-sm">
              Create the file{' '}
              <code className="bg-muted rounded px-1 py-0.5">.github/workflows/codaholiq.yml</code>{' '}
              in your repository with the following content:
            </p>
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-2"
                onClick={() => void copy(WORKFLOW_YAML)}
              >
                {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              <pre className="bg-muted overflow-x-auto rounded-lg p-4 text-xs">
                <code>{WORKFLOW_YAML}</code>
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
