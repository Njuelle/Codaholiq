import { Badge } from '@/common/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/common/components/ui/table';
import type { Repository } from '@/common/types';
import { useNavigate } from 'react-router-dom';
import type { ReactElement } from 'react';

interface RepoTableProps {
  readonly repos: readonly Repository[];
  readonly orgId: number;
}

export function RepoTable({ repos, orgId }: RepoTableProps): ReactElement {
  const navigate = useNavigate();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Language</TableHead>
          <TableHead>Visibility</TableHead>
          <TableHead>Default Branch</TableHead>
          <TableHead>Webhook</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {repos.map((repo) => (
          <TableRow
            key={repo.id}
            className="cursor-pointer"
            onClick={() => void navigate(`/orgs/${orgId}/repos/${repo.id}`)}
          >
            <TableCell className="font-medium">{repo.fullName}</TableCell>
            <TableCell className="text-muted-foreground">{repo.language ?? '-'}</TableCell>
            <TableCell>
              <Badge variant={repo.private ? 'secondary' : 'outline'}>
                {repo.private ? 'Private' : 'Public'}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">{repo.defaultBranch}</TableCell>
            <TableCell>
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  repo.webhookActive ? 'bg-green-500' : 'bg-red-500'
                }`}
                aria-label={repo.webhookActive ? 'Webhook active' : 'Webhook inactive'}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
