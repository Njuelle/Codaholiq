import { Button } from '@/common/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/common/components/ui/dialog';
import { Input } from '@/common/components/ui/input';
import { Label } from '@/common/components/ui/label';
import type { AutomationWithVariables, ManualTriggerResponse } from '@/common/types';
import { CheckCircle } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';

interface TriggerAutomationDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly automation: AutomationWithVariables;
  readonly onTrigger: (variables?: Record<string, string>) => void;
  readonly isPending: boolean;
  readonly result?: ManualTriggerResponse;
}

function buildInitialOverrides(automation: AutomationWithVariables): Record<string, string> {
  const overrides: Record<string, string> = {};
  for (const variable of automation.variables) {
    overrides[variable.key] = variable.value;
  }
  return overrides;
}

export function TriggerAutomationDialog({
  open,
  onOpenChange,
  automation,
  onTrigger,
  isPending,
  result,
}: TriggerAutomationDialogProps): ReactElement {
  const [overrides, setOverrides] = useState<Record<string, string>>(() =>
    buildInitialOverrides(automation),
  );

  // Reset overrides when dialog opens — React-recommended render-time state sync
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setOverrides(buildInitialOverrides(automation));
    }
  }

  const handleVariableChange = (key: string, value: string): void => {
    setOverrides((prev) => ({ ...prev, [key]: value }));
  };

  const handleTrigger = (): void => {
    const hasVariables = automation.variables.length > 0;
    onTrigger(hasVariables ? overrides : undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trigger {automation.name}</DialogTitle>
          <DialogDescription>
            Manually trigger this automation. This will create a new execution.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle className="size-10 text-green-600" />
            <p className="text-sm font-medium">Automation triggered successfully</p>
            <p className="text-sm text-muted-foreground">
              Execution #{result.executionId} is now {result.status}.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/orgs/${automation.orgId}/executions/${result.executionId}`}>
                View Execution
              </Link>
            </Button>
          </div>
        ) : (
          <>
            {automation.variables.length > 0 && (
              <div className="space-y-4 max-h-64 overflow-y-auto">
                {automation.variables.map((variable) => (
                  <div key={variable.key} className="space-y-2">
                    <Label htmlFor={`var-${variable.key}`}>
                      {variable.key}
                      {variable.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <Input
                      id={`var-${variable.key}`}
                      value={overrides[variable.key] ?? ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        handleVariableChange(variable.key, e.target.value)
                      }
                      placeholder={variable.value}
                      disabled={isPending}
                    />
                    <p className="text-xs text-muted-foreground">Source: {variable.source}</p>
                  </div>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button onClick={handleTrigger} disabled={isPending}>
                {isPending ? 'Triggering...' : 'Trigger'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
