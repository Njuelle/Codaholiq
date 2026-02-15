import { Checkbox } from '@/common/components/ui/checkbox';
import { Input } from '@/common/components/ui/input';
import { Label } from '@/common/components/ui/label';
import { Search } from 'lucide-react';
import type { ReactElement } from 'react';

interface RepoFiltersProps {
  readonly search: string;
  readonly showArchived: boolean;
  readonly onSearchChange: (value: string) => void;
  readonly onShowArchivedChange: (value: boolean) => void;
}

export function RepoFilters({
  search,
  showArchived,
  onSearchChange,
  onShowArchivedChange,
}: RepoFiltersProps): ReactElement {
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <Search className="text-muted-foreground absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="Search repositories..."
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
          className="w-[250px] pl-8"
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="show-archived"
          checked={showArchived}
          onCheckedChange={(checked: boolean | 'indeterminate') =>
            onShowArchivedChange(checked === true)
          }
        />
        <Label htmlFor="show-archived">Show archived</Label>
      </div>
    </div>
  );
}
