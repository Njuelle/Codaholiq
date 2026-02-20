import type { Repository } from '@/common/types';
import { useRepositories } from './use-repositories';

interface UseReposParams {
  readonly orgId: number;
  readonly search?: string;
}

interface UseReposReturn {
  readonly repos: readonly Repository[];
  readonly isLoading: boolean;
}

export function useRepos({ orgId, search }: UseReposParams): UseReposReturn {
  const { repos, isLoading } = useRepositories({
    orgId,
    filters: { limit: 100, search },
  });

  return { repos, isLoading };
}
