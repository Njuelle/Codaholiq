import { Button } from '@/common/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/common/components/ui/card';
import { useClipboard } from '@/common/hooks/use-clipboard';
import { useExecutionLogs } from '@/modules/executions/hooks/use-execution-logs';
import { formatDate } from '@/common/lib/format';
import { cn } from '@/common/lib/utils';
import type { ExecutionLog, ExecutionStatus, LogLevel } from '@/common/types';
import { Check, Copy, Download, ArrowDown } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useEffect, useState, useCallback, type ReactElement } from 'react';

interface LogViewerProps {
  readonly orgId: number;
  readonly executionId: number;
  readonly executionStatus: ExecutionStatus;
}

const LOG_LINE_HEIGHT = 24;

const LEVEL_COLORS: Record<LogLevel, string> = {
  info: 'text-gray-300',
  debug: 'text-gray-500',
  warn: 'text-yellow-400',
  error: 'text-red-400',
};

const LEVEL_LABELS: Record<LogLevel, string> = {
  info: 'INFO',
  debug: 'DEBUG',
  warn: 'WARN',
  error: 'ERROR',
};

function LogLine({ log }: { readonly log: ExecutionLog }): ReactElement {
  return (
    <div className="flex gap-2 px-4 py-0.5 hover:bg-gray-800/50">
      <span className="shrink-0 text-gray-500">{formatDate(log.timestamp)}</span>
      <span className={cn('shrink-0 w-12 text-right font-bold', LEVEL_COLORS[log.level])}>
        {LEVEL_LABELS[log.level]}
      </span>
      <span className={cn('break-all', LEVEL_COLORS[log.level])}>{log.message}</span>
    </div>
  );
}

function formatLogsForExport(logs: readonly ExecutionLog[]): string {
  return logs
    .map((log) => `[${log.timestamp}] [${LEVEL_LABELS[log.level]}] ${log.message}`)
    .join('\n');
}

export function LogViewer({ orgId, executionId, executionStatus }: LogViewerProps): ReactElement {
  const { logs, isLoading, isStreaming } = useExecutionLogs({
    orgId,
    executionId,
    executionStatus,
  });

  const { isCopied, copy } = useClipboard();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const userScrolledRef = useRef(false);

  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => LOG_LINE_HEIGHT,
    overscan: 20,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  const handleScroll = useCallback((): void => {
    const el = scrollRef.current;
    if (!el) return;

    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (!isAtBottom) {
      userScrolledRef.current = true;
      setAutoScroll(false);
    } else {
      userScrolledRef.current = false;
      setAutoScroll(true);
    }
  }, []);

  useEffect(() => {
    if (!autoScroll || logs.length === 0) return;
    virtualizer.scrollToIndex(logs.length - 1, { align: 'end' });
  }, [logs.length, autoScroll, virtualizer]);

  const handleCopy = useCallback((): void => {
    void copy(formatLogsForExport(logs));
  }, [copy, logs]);

  const handleDownload = useCallback((): void => {
    const text = formatLogsForExport(logs);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `execution-${executionId}-logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [logs, executionId]);

  const handleFollowClick = useCallback((): void => {
    setAutoScroll(true);
    userScrolledRef.current = false;
    if (logs.length > 0) {
      virtualizer.scrollToIndex(logs.length - 1, { align: 'end' });
    }
  }, [logs.length, virtualizer]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Logs
          <span className="text-xs font-normal text-muted-foreground">
            ({logs.length} {logs.length === 1 ? 'entry' : 'entries'})
          </span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-xs font-normal text-green-600">
              <span className="size-2 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          )}
        </CardTitle>
        <CardAction>
          <div className="flex items-center gap-1">
            {!autoScroll && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFollowClick}
                aria-label="Scroll to bottom"
              >
                <ArrowDown className="size-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              disabled={logs.length === 0}
              aria-label="Copy logs"
            >
              {isCopied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              disabled={logs.length === 0}
              aria-label="Download logs"
            >
              <Download className="size-4" />
            </Button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="max-h-[600px] overflow-y-auto rounded-b-lg bg-gray-900 py-2 font-mono text-xs"
          role="log"
          aria-live="polite"
          aria-label="Execution logs"
        >
          {isLoading ? (
            <p className="px-4 py-8 text-center text-gray-500">Loading logs...</p>
          ) : logs.length === 0 ? (
            <p className="px-4 py-8 text-center text-gray-500">No logs yet.</p>
          ) : (
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const log = logs[virtualItem.index];
                if (!log) return null;
                return (
                  <div
                    key={log.id}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <LogLine log={log} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
