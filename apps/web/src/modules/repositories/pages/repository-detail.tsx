import { SetupStatusCard } from '@/modules/repositories/components/setup-status-card';
import { ModelPolicyCard } from '@/modules/repositories/components/model-policy-card';
import { RepoAutomationsSection } from '@/modules/repositories/components/repo-automations-section';
import { RepoExecutionsSection } from '@/modules/repositories/components/repo-executions-section';
import { WebhookToggle } from '@/modules/repositories/components/webhook-toggle';
import { PageHeader } from '@/common/components/page-header';
import { Badge } from '@/common/components/ui/badge';
import { Button } from '@/common/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card';
import { Skeleton } from '@/common/components/ui/skeleton';
import { useOrg } from '@/modules/organizations/hooks/use-org';
import { useRepository } from '@/modules/repositories/hooks/use-repository';
import { useSetupStatus } from '@/modules/repositories/hooks/use-setup-status';
import { useToggleWebhook } from '@/modules/repositories/hooks/use-toggle-webhook';
import { useHasPermission } from '@/modules/permissions/hooks/use-has-permission';
import { Permission } from '@/common/types';
import { formatDate } from '@/common/lib/format';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ReactElement } from 'react';

export function RepositoryDetailPage(): ReactElement {
  const { org } = useOrg();
  const navigate = useNavigate();
  const { repoId: repoIdParam } = useParams<{ repoId: string }>();

  const orgId = org?.id ?? 0;
  const repoId = Number(repoIdParam);

  const { repo, isLoading, isError, error } = useRepository({ orgId, repoId });
  const {
    workflowFileExists,
    workflowFileUpToDate,
    secretsConfigured,
    hasAnthropicKey,
    hasOAuthToken,
    providerSecrets,
    isLoading: isSetupLoading,
    isError: isSetupError,
  } = useSetupStatus({ orgId, repoId });
  const toggleWebhook = useToggleWebhook({ orgId, repoId });
  const { hasPermission } = useHasPermission({ orgId });

  if (Number.isNaN(repoId)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Repository" />
        <p className="text-destructive text-sm">Invalid repository ID</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !repo) {
    return (
      <div className="space-y-6">
        <PageHeader title="Repository" />
        <p className="text-destructive text-sm">{error?.message ?? 'Repository not found'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => void navigate(`/orgs/${orgId}/repos`)}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
      </div>

      <PageHeader
        title={repo.fullName}
        description={repo.private ? 'Private repository' : 'Public repository'}
        actions={
          <div className="flex items-center gap-2">
            {repo.archived && <Badge variant="destructive">Archived</Badge>}
            <Badge variant="outline">{repo.defaultBranch}</Badge>
            {repo.language && <Badge variant="secondary">{repo.language}</Badge>}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <SetupStatusCard
            workflowFileExists={workflowFileExists}
            workflowFileUpToDate={workflowFileUpToDate}
            secretsConfigured={secretsConfigured}
            hasAnthropicKey={hasAnthropicKey}
            hasOAuthToken={hasOAuthToken}
            providerSecrets={providerSecrets}
            repoFullName={repo.fullName}
            isLoading={isSetupLoading}
            isError={isSetupError}
            orgId={orgId}
            repoId={repoId}
            canEdit={hasPermission(Permission.ORG_SETTINGS_EDIT)}
          />
          <RepoAutomationsSection orgId={orgId} repoId={repoId} />
          <RepoExecutionsSection orgId={orgId} repoId={repoId} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <WebhookToggle
                isActive={repo.webhookActive}
                onToggle={(active) => toggleWebhook.mutate(active)}
                isPending={toggleWebhook.isPending}
                canEdit={hasPermission(Permission.ORG_SETTINGS_EDIT)}
              />
            </CardContent>
          </Card>

          <ModelPolicyCard
            orgId={orgId}
            repoId={repoId}
            canManage={hasPermission(Permission.MODEL_POLICIES_MANAGE)}
          />

          <Card>
            <CardHeader>
              <CardTitle>Repository Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Owner</span>
                <span>{repo.owner}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Default branch</span>
                <span>{repo.defaultBranch}</span>
              </div>
              {repo.language && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Language</span>
                  <span>{repo.language}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last synced</span>
                <span>{formatDate(repo.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
