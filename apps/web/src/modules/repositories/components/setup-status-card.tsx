import { Button } from '@/common/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card';
import { Skeleton } from '@/common/components/ui/skeleton';
import { useClipboard } from '@/common/hooks/use-clipboard';
import { useCreateWorkflowPR } from '@/modules/repositories/hooks/use-create-workflow-pr';
import { useWorkflowTemplate } from '@/modules/executions/hooks/use-workflow-template';
import {
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  GitPullRequest,
  Loader2,
  ExternalLink,
  KeyRound,
} from 'lucide-react';
import type { ReactElement } from 'react';

const GITHUB_URL_PREFIX = 'https://github.com/';

interface SetupStatusCardProps {
  readonly workflowFileExists: boolean | undefined;
  readonly secretsConfigured: boolean | undefined;
  readonly hasAnthropicKey: boolean | undefined;
  readonly hasOAuthToken: boolean | undefined;
  readonly repoFullName: string | undefined;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly orgId: number;
  readonly repoId: number;
  readonly canEdit: boolean;
}

export function SetupStatusCard({
  workflowFileExists,
  secretsConfigured,
  hasAnthropicKey,
  hasOAuthToken,
  repoFullName,
  isLoading,
  isError,
  orgId,
  repoId,
  canEdit,
}: SetupStatusCardProps): ReactElement {
  const { isCopied, copy } = useClipboard();
  const createPR = useCreateWorkflowPR({ orgId, repoId });
  const { template: workflowYaml = '' } = useWorkflowTemplate();

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
      <CardContent className="space-y-6">
        {/* Step 1: Workflow file */}
        <div>
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
              {createPR.isSuccess && (
                <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm">
                    Pull request created:{' '}
                    {createPR.data.pullRequestUrl.startsWith(GITHUB_URL_PREFIX) ? (
                      <a
                        href={createPR.data.pullRequestUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium underline"
                      >
                        View on GitHub
                      </a>
                    ) : (
                      <span className="font-medium">check your repository for the new PR</span>
                    )}
                  </span>
                </div>
              )}
              {canEdit && !createPR.isSuccess && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => createPR.mutate()}
                  disabled={createPR.isPending}
                >
                  {createPR.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating PR...
                    </>
                  ) : (
                    <>
                      <GitPullRequest className="mr-2 h-4 w-4" />
                      Create PR
                    </>
                  )}
                </Button>
              )}
              <p className="text-muted-foreground text-sm">
                {canEdit && !createPR.isSuccess
                  ? 'Or manually create the file '
                  : 'Create the file '}
                <code className="bg-muted rounded px-1 py-0.5">
                  .github/workflows/codaholiq.yml
                </code>{' '}
                in your repository with the following content:
              </p>
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-2"
                  onClick={() => void copy(workflowYaml)}
                >
                  {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <pre className="bg-muted overflow-x-auto rounded-lg p-4 text-xs">
                  <code>{workflowYaml}</code>
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: API secrets */}
        {secretsConfigured !== undefined && (
          <div>
            {secretsConfigured ? (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <KeyRound className="h-5 w-5" />
                <span className="text-sm font-medium">
                  API key configured
                  {hasAnthropicKey && hasOAuthToken
                    ? ' (ANTHROPIC_API_KEY + CLAUDE_CODE_OAUTH_TOKEN)'
                    : hasAnthropicKey
                      ? ' (ANTHROPIC_API_KEY)'
                      : ' (CLAUDE_CODE_OAUTH_TOKEN)'}
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="text-sm font-medium">No API key found</span>
                </div>
                <p className="text-muted-foreground text-sm">
                  Set <code className="bg-muted rounded px-1 py-0.5">ANTHROPIC_API_KEY</code> or{' '}
                  <code className="bg-muted rounded px-1 py-0.5">CLAUDE_CODE_OAUTH_TOKEN</code> in
                  your repository&apos;s GitHub Actions secrets.
                </p>
                {repoFullName && (
                  <a
                    href={`https://github.com/${repoFullName}/settings/secrets/actions`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 underline dark:text-blue-400"
                  >
                    Manage secrets on GitHub
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
