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
import { useState, type ReactElement } from 'react';

interface DeleteAutomationDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly automationName: string;
  readonly onConfirm: () => void;
  readonly isLoading: boolean;
}

export function DeleteAutomationDialog({
  open,
  onOpenChange,
  automationName,
  onConfirm,
  isLoading,
}: DeleteAutomationDialogProps): ReactElement {
  const [confirmValue, setConfirmValue] = useState('');

  const isConfirmed = confirmValue === automationName;

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen) {
      setConfirmValue('');
    }
    onOpenChange(nextOpen);
  };

  const handleConfirm = (): void => {
    if (!isConfirmed) return;
    onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Automation</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the automation{' '}
            <strong>{automationName}</strong> and all of its associated data including execution
            history.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="confirm-name">
            Type <strong>{automationName}</strong> to confirm
          </Label>
          <Input
            id="confirm-name"
            value={confirmValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmValue(e.target.value)}
            placeholder={automationName}
            disabled={isLoading}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmed || isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
