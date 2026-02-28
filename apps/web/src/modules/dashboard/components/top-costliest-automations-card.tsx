import { Card, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card';
import { formatCost, formatTokens } from '@/common/lib/format';
import type { AutomationCostBreakdown } from '@/common/types';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

interface TopCostliestAutomationsCardProps {
  readonly automations: readonly AutomationCostBreakdown[];
  readonly orgId: number;
}

export function TopCostliestAutomationsCard({
  automations,
  orgId,
}: TopCostliestAutomationsCardProps): ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Costliest Automations (30d)</CardTitle>
      </CardHeader>
      <CardContent>
        {automations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cost data available yet.</p>
        ) : (
          <div className="space-y-3">
            {automations.map((automation) => (
              <div
                key={automation.automationId}
                className="flex items-center justify-between rounded-md px-2 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/orgs/${orgId}/automations/${automation.automationId}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {automation.automationName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {automation.executionCount} executions &middot;{' '}
                    {formatTokens(automation.totalInputTokens)} in /{' '}
                    {formatTokens(automation.totalOutputTokens)} out
                  </p>
                </div>
                <span className="text-sm font-semibold">
                  {formatCost(automation.totalCostMicros)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
