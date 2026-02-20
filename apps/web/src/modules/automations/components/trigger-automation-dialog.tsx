import { Button } from '@/common/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/common/components/ui/dialog';
import type { ManualTriggerResponse } from '@/common/types';
import { CheckCircle } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

interface TriggerAutomationDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly automationName: string;
  readonly automationOrgId: number;
  readonly onTrigger: () => void;
  readonly isPending: boolean;
  readonly result?: ManualTriggerResponse;
}

export function TriggerAutomationDialog({
  open,
  onOpenChange,
  automationName,
  automationOrgId,
  onTrigger,
  isPending,
  result,
}: TriggerAutomationDialogProps): ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trigger {automationName}</DialogTitle>
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
              <Link to={`/orgs/${automationOrgId}/executions/${result.executionId}`}>
                View Execution
              </Link>
            </Button>
          </div>
        ) : (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={onTrigger} disabled={isPending}>
              {isPending ? 'Triggering...' : 'Trigger'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
