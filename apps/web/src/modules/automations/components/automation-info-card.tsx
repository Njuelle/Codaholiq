import { Badge } from '@/common/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card';
import { TriggerBadge } from '@/common/components/trigger-badge';
import { OPERATOR_LABELS } from '@/modules/automations/lib/condition-operators';
import { formatCronExpression, formatDate } from '@/common/lib/format';
import type {
  AutomationWithVariables,
  ConditionGroup,
  CronTriggerConfig,
  EventTriggerConfig,
} from '@/common/types';
import type { ReactElement } from 'react';

interface AutomationInfoCardProps {
  readonly automation: AutomationWithVariables;
}

function TriggerDetails({
  automation,
}: {
  readonly automation: AutomationWithVariables;
}): ReactElement {
  switch (automation.triggerType) {
    case 'event': {
      const config = automation.triggerConfig as EventTriggerConfig;
      const groups = config.conditionGroups ?? [];
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {config.events.map((event) => (
              <Badge key={event} variant="secondary">
                {event}
              </Badge>
            ))}
          </div>
          {groups.length > 0 && (
            <div className="text-muted-foreground text-xs">
              {groups.map((group: ConditionGroup, gIdx: number) => (
                <span key={gIdx}>
                  {gIdx > 0 && <span className="font-semibold"> OR </span>}
                  {group.conditions.length > 1 && '('}
                  {group.conditions.map((c, cIdx) => (
                    <span key={cIdx}>
                      {cIdx > 0 && <span className="font-semibold"> AND </span>}
                      <code className="font-mono">{c.path}</code>{' '}
                      {OPERATOR_LABELS[c.operator] ?? c.operator}
                      {c.value ? ` "${c.value}"` : ''}
                    </span>
                  ))}
                  {group.conditions.length > 1 && ')'}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    }
    case 'cron': {
      const config = automation.triggerConfig as CronTriggerConfig;
      return (
        <div className="space-y-1">
          <code className="text-sm font-mono">{config.schedule}</code>
          <p className="text-sm text-muted-foreground">{formatCronExpression(config.schedule)}</p>
          {config.timezone && (
            <p className="text-xs text-muted-foreground">Timezone: {config.timezone}</p>
          )}
        </div>
      );
    }
    case 'manual':
      return <p className="text-sm text-muted-foreground">Triggered manually</p>;
  }
}

export function AutomationInfoCard({ automation }: AutomationInfoCardProps): ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4">
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Description</dt>
            <dd className="mt-1 text-sm">
              {automation.description ?? (
                <span className="text-muted-foreground">No description</span>
              )}
            </dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-muted-foreground">Trigger Type</dt>
            <dd className="mt-1 space-y-2">
              <TriggerBadge triggerType={automation.triggerType} />
              <TriggerDetails automation={automation} />
            </dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-muted-foreground">Model</dt>
            <dd className="mt-1 text-sm">
              {automation.model ?? <span className="text-muted-foreground">Default</span>}
            </dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-muted-foreground">Created</dt>
            <dd className="mt-1 text-sm">{formatDate(automation.createdAt)}</dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-muted-foreground">Updated</dt>
            <dd className="mt-1 text-sm">{formatDate(automation.updatedAt)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
