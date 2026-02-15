import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/common/lib/api-client';

interface GitHubEventAction {
  readonly name: string;
  readonly description: string;
}

export interface GitHubEventPayloadPath {
  readonly path: string;
  readonly description: string;
}

export interface GitHubEventDefinition {
  readonly event: string;
  readonly description: string;
  readonly category: string;
  readonly actions: readonly GitHubEventAction[];
  readonly conclusions?: readonly string[];
  readonly payloadPaths?: readonly GitHubEventPayloadPath[];
  readonly hasEntityBuiltIns?: boolean;
}

export interface GitHubEventCategory {
  readonly id: string;
  readonly label: string;
}

interface GitHubEventsResponse {
  readonly categories: readonly GitHubEventCategory[];
  readonly events: readonly GitHubEventDefinition[];
}

interface UseGitHubEventsReturn {
  readonly categories: readonly GitHubEventCategory[];
  readonly events: readonly GitHubEventDefinition[];
  readonly isLoading: boolean;
}

export function useGitHubEvents(): UseGitHubEventsReturn {
  const { data, isLoading } = useQuery({
    queryKey: ['github-events'],
    queryFn: () => apiGet<GitHubEventsResponse>('/github-events'),
    staleTime: Infinity,
  });

  return {
    categories: data?.categories ?? [],
    events: data?.events ?? [],
    isLoading,
  };
}

/**
 * Merge payload path suggestions from all selected events, deduplicating by path.
 */
export function getPayloadPathsForEvents({
  events,
  allEvents,
}: {
  readonly events: readonly string[];
  readonly allEvents: readonly GitHubEventDefinition[];
}): readonly GitHubEventPayloadPath[] {
  const seen = new Set<string>();
  const result: GitHubEventPayloadPath[] = [];

  for (const eventStr of events) {
    const baseEvent = eventStr.split('.')[0]!;
    const def = allEvents.find((e) => e.event === baseEvent);
    if (!def?.payloadPaths) continue;

    for (const pp of def.payloadPaths) {
      if (seen.has(pp.path)) continue;
      seen.add(pp.path);
      result.push(pp);
    }
  }

  return result;
}
