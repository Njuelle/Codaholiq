import { RepoFilters } from '@/modules/repositories/components/repo-filters';
import { RepoTable } from '@/modules/repositories/components/repo-table';
import { EmptyState } from '@/common/components/empty-state';
import { PageHeader } from '@/common/components/page-header';
import { Button } from '@/common/components/ui/button';
import { Skeleton } from '@/common/components/ui/skeleton';
import { useOrg } from '@/modules/organizations/hooks/use-org';
import { useRepositories } from '@/modules/repositories/hooks/use-repositories';
import { useSyncRepos } from '@/modules/repositories/hooks/use-sync-repos';
import { GitFork, RefreshCw } from 'lucide-react';
import { useCallback, useState, type ReactElement } from 'react';

const PAGE_SIZE = 20;

export function RepositoryListPage(): ReactElement {
  const { org } = useOrg();

  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(0);

  const orgId = org?.id ?? 0;

  const { repos, total, isLoading, isError, error } = useRepositories({
    orgId,
    filters: {
      search: search || undefined,
      archived: showArchived || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    },
  });

  const syncMutation = useSyncRepos({ orgId });

  const handleSearchChange = useCallback((value: string): void => {
    setSearch(value);
    setPage(0);
  }, []);

  const handleShowArchivedChange = useCallback((value: boolean): void => {
    setShowArchived(value);
    setPage(0);
  }, []);

  const handlePreviousPage = useCallback((): void => {
    setPage((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNextPage = useCallback((): void => {
    setPage((prev) => prev + 1);
  }, []);

  const handleSync = (): void => {
    syncMutation.mutate();
  };

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Repositories" description="Manage your connected repositories." />
        <p className="text-destructive text-sm">
          Failed to load repositories: {error?.message ?? 'Unknown error'}
        </p>
      </div>
    );
  }

  const isEmpty = !isLoading && repos.length === 0 && page === 0 && !search;
  const hasNextPage = repos.length === PAGE_SIZE;
  const pageStart = page * PAGE_SIZE + 1;
  const pageEnd = page * PAGE_SIZE + repos.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Repositories"
        description="Manage your connected repositories."
        actions={
          <Button onClick={handleSync} disabled={syncMutation.isPending}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Sync Repos
          </Button>
        }
      />

      <RepoFilters
        search={search}
        showArchived={showArchived}
        onSearchChange={handleSearchChange}
        onShowArchivedChange={handleShowArchivedChange}
      />

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {isEmpty && (
        <EmptyState
          icon={GitFork}
          title="No repositories found"
          description="Repositories will appear here once you install the GitHub App on your organization."
          action={{
            label: 'Sync Repos',
            onClick: handleSync,
          }}
        />
      )}

      {!isLoading && repos.length > 0 && (
        <>
          <RepoTable repos={repos} orgId={orgId} />

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {pageStart}-{pageEnd} of {total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={page === 0}
              >
                Previous
              </Button>
              <Button variant="outline" size="sm" onClick={handleNextPage} disabled={!hasNextPage}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
