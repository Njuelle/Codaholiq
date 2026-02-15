import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/common/lib/api-client';
import { TERMINAL_STATUSES } from '@/modules/executions/lib/execution-utils';
import { queryKeys } from '@/common/lib/query-keys';
import { useSSE } from '@/common/hooks/use-sse';
import type { ExecutionLog, ExecutionStatus } from '@/common/types';

interface SSELogMessage {
  readonly type: 'log' | 'status' | 'heartbeat';
  readonly data?: ExecutionLog;
}

interface UseExecutionLogsParams {
  readonly orgId: number;
  readonly executionId: number;
  readonly executionStatus: ExecutionStatus;
}

interface UseExecutionLogsReturn {
  readonly logs: readonly ExecutionLog[];
  readonly isLoading: boolean;
  readonly isStreaming: boolean;
  readonly error: Error | null;
}

export function useExecutionLogs({
  orgId,
  executionId,
  executionStatus,
}: UseExecutionLogsParams): UseExecutionLogsReturn {
  const isTerminal = TERMINAL_STATUSES.has(executionStatus);

  const {
    data: initialLogs,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.executions.logs({ orgId, executionId }),
    queryFn: () =>
      apiGet<ExecutionLog[]>(`/orgs/${orgId}/executions/${executionId}/logs`, { limit: 500 }),
    enabled: orgId > 0 && executionId > 0,
  });

  const { events: sseEvents, isConnected } = useSSE<SSELogMessage>({
    url: `/orgs/${orgId}/executions/${executionId}/logs/stream`,
    enabled: !isTerminal,
  });

  const logs = useMemo(() => {
    const base = initialLogs ?? [];
    const streamed = sseEvents
      .filter((e) => e.type === 'log' && e.data != null)
      .map((e) => e.data!);

    if (streamed.length === 0) return base;

    const seenIds = new Set(base.map((l) => l.id));
    const merged = [...base];
    for (const log of streamed) {
      if (!seenIds.has(log.id)) {
        seenIds.add(log.id);
        merged.push(log);
      }
    }
    return merged;
  }, [initialLogs, sseEvents]);

  return {
    logs,
    isLoading,
    isStreaming: isConnected,
    error,
  };
}
