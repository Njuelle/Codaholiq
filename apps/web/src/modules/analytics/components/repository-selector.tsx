import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/common/components/ui/select';
import type { Repository } from '@/common/types';
import type { ReactElement } from 'react';

interface RepositorySelectorProps {
  readonly repoId: number | undefined;
  readonly repositories: readonly Repository[];
  readonly onRepoIdChange: (repoId: number | undefined) => void;
}

export function RepositorySelector({
  repoId,
  repositories,
  onRepoIdChange,
}: RepositorySelectorProps): ReactElement {
  const handleChange = (value: string): void => {
    onRepoIdChange(value === 'all' ? undefined : Number(value));
  };

  return (
    <Select value={repoId !== undefined ? String(repoId) : 'all'} onValueChange={handleChange}>
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Repository" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Repositories</SelectItem>
        {repositories.map((repo) => (
          <SelectItem key={repo.id} value={String(repo.id)}>
            {repo.fullName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
