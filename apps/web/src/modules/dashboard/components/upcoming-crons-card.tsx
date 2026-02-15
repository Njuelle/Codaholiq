import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card';
import { formatDate } from '@/common/lib/format';
import type { UpcomingCronTrigger } from '@/common/types';
import { Clock } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

interface UpcomingCronsCardProps {
  readonly triggers: readonly UpcomingCronTrigger[];
  readonly orgId: number;
}

export function UpcomingCronsCard({ triggers, orgId }: UpcomingCronsCardProps): ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Cron Triggers</CardTitle>
      </CardHeader>
      <CardContent>
        {triggers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming cron triggers.</p>
        ) : (
          <div className="space-y-3">
            {triggers.map((trigger) => (
              <div
                key={`${trigger.automationId}-${trigger.nextFireAt}`}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-muted-foreground" />
                  <Link
                    to={`/orgs/${orgId}/automations/${trigger.automationId}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {trigger.automationName}
                  </Link>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDate(trigger.nextFireAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
