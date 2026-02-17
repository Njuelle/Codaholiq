import { useState, type ReactElement } from 'react';
import { Button } from '@/common/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/common/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/common/components/ui/select';
import { useRepos } from '@/modules/repositories/hooks/use-repos';

interface RepoSelectDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly orgId: number;
  readonly templateName: string;
  readonly onConfirm: (repoId: number) => void;
  readonly isLoading: boolean;
}

export function RepoSelectDialog({
  open,
  onOpenChange,
  orgId,
  templateName,
  onConfirm,
  isLoading,
}: RepoSelectDialogProps): ReactElement {
  const { repos, isLoading: reposLoading } = useRepos({ orgId });
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null);

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen) {
      setSelectedRepoId(null);
    }
    onOpenChange(nextOpen);
  };

  const handleConfirm = (): void => {
    if (selectedRepoId === null) return;
    onConfirm(selectedRepoId);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select a Repository</DialogTitle>
          <DialogDescription>
            Choose a repository for the <strong>{templateName}</strong> automation.
          </DialogDescription>
        </DialogHeader>

        <Select
          disabled={reposLoading}
          value={selectedRepoId !== null ? String(selectedRepoId) : ''}
          onValueChange={(value: string) => setSelectedRepoId(Number(value))}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={reposLoading ? 'Loading...' : 'Select a repository'} />
          </SelectTrigger>
          <SelectContent>
            {repos.map((repo) => (
              <SelectItem key={repo.id} value={String(repo.id)}>
                {repo.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={selectedRepoId === null || isLoading}>
            {isLoading ? 'Creating...' : 'Create Automation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
