import { Badge } from '@/common/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card';
import { Skeleton } from '@/common/components/ui/skeleton';
import { useAutomations } from '@/modules/automations/hooks/use-automations';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/common/components/ui/button';
import type { ReactElement } from 'react';

interface RepoAutomationsSectionProps {
  readonly orgId: number;
  readonly repoId: number;
}

const TRIGGER_LABELS: Record<string, string> = {
  event: 'Event',
  cron: 'Cron',
  manual: 'Manual',
};

export function RepoAutomationsSection({
  orgId,
  repoId,
}: RepoAutomationsSectionProps): ReactElement {
  const { automations, isLoading } = useAutomations({
    orgId,
    filters: { repoId },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Automations</CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/orgs/${orgId}/automations/new`}>
            <Plus className="mr-1 h-4 w-4" />
            Create
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}

        {!isLoading && automations.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No automations configured for this repository.
          </p>
        )}

        {!isLoading && automations.length > 0 && (
          <div className="space-y-2">
            {automations.map((automation) => (
              <Link
                key={automation.id}
                to={`/orgs/${orgId}/automations/${automation.id}`}
                className="hover:bg-muted flex items-center justify-between rounded-md border p-3 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{automation.name}</span>
                  <Badge variant="outline">
                    {TRIGGER_LABELS[automation.triggerType] ?? automation.triggerType}
                  </Badge>
                </div>
                <Badge variant={automation.enabled ? 'default' : 'secondary'}>
                  {automation.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
