import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw-server';
import { useGitHubEvents, getPayloadPathsForEvents } from '../use-github-events';
import type { GitHubEventDefinition } from '../use-github-events';
import type { ReactNode } from 'react';
import { createElement } from 'react';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useGitHubEvents', () => {
  it('should return empty arrays while loading', () => {
    const { result } = renderHook(() => useGitHubEvents(), {
      wrapper: createWrapper(),
    });

    expect(result.current.categories).toEqual([]);
    expect(result.current.events).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it('should return categories and events after successful fetch', async () => {
    const mockCategories = [
      { id: 'ci', label: 'CI/CD' },
      { id: 'code', label: 'Code Review' },
    ];
    const mockEvents = [
      {
        event: 'push',
        description: 'Push to a branch',
        category: 'ci',
        actions: [],
      },
      {
        event: 'pull_request',
        description: 'Pull request activity',
        category: 'code',
        actions: [
          { name: 'opened', description: 'Pull request opened' },
          { name: 'closed', description: 'Pull request closed' },
        ],
      },
    ];

    server.use(
      http.get('/api/github-events', () => {
        return HttpResponse.json({
          data: { categories: mockCategories, events: mockEvents },
          requestId: 'test-request-id',
        });
      }),
    );

    const { result } = renderHook(() => useGitHubEvents(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.categories).toEqual(mockCategories);
    expect(result.current.events).toEqual(mockEvents);
    expect(result.current.categories).toHaveLength(2);
    expect(result.current.events).toHaveLength(2);
    expect(result.current.events[1]!.actions).toHaveLength(2);
  });

  it('should return events with payloadPaths', async () => {
    const mockEvents = [
      {
        event: 'push',
        description: 'Push to a branch',
        category: 'ci',
        actions: [],
        payloadPaths: [
          { path: 'ref', description: 'Branch or tag ref' },
          { path: 'pusher.name', description: 'Username of the pusher' },
        ],
      },
    ];

    server.use(
      http.get('/api/github-events', () => {
        return HttpResponse.json({
          data: { categories: [], events: mockEvents },
          requestId: 'test-request-id',
        });
      }),
    );

    const { result } = renderHook(() => useGitHubEvents(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.events[0]!.payloadPaths).toHaveLength(2);
    expect(result.current.events[0]!.payloadPaths![0]!.path).toBe('ref');
  });

  it('should handle API error gracefully', async () => {
    server.use(
      http.get('/api/github-events', () => {
        return HttpResponse.json(
          { statusCode: 500, error: 'Internal Server Error', message: 'Something went wrong' },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHook(() => useGitHubEvents(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.categories).toEqual([]);
    expect(result.current.events).toEqual([]);
  });
});

describe('getPayloadPathsForEvents', () => {
  const allEvents: readonly GitHubEventDefinition[] = [
    {
      event: 'push',
      description: 'Push',
      category: 'ci',
      actions: [],
      payloadPaths: [
        { path: 'ref', description: 'Branch ref' },
        { path: 'pusher.name', description: 'Pusher' },
      ],
    },
    {
      event: 'pull_request',
      description: 'PR',
      category: 'code',
      actions: [{ name: 'opened', description: 'Opened' }],
      payloadPaths: [
        { path: 'pull_request.base.ref', description: 'Target branch' },
        { path: 'pull_request.draft', description: 'Is draft' },
      ],
    },
    {
      event: 'issues',
      description: 'Issues',
      category: 'issues',
      actions: [{ name: 'labeled', description: 'Labeled' }],
    },
  ];

  it('should return payload paths for selected events', () => {
    const paths = getPayloadPathsForEvents({ events: ['push'], allEvents });

    expect(paths).toHaveLength(2);
    expect(paths[0]!.path).toBe('ref');
    expect(paths[1]!.path).toBe('pusher.name');
  });

  it('should merge paths from multiple events', () => {
    const paths = getPayloadPathsForEvents({
      events: ['push', 'pull_request.opened'],
      allEvents,
    });

    expect(paths).toHaveLength(4);
    expect(paths.map((p) => p.path)).toEqual([
      'ref',
      'pusher.name',
      'pull_request.base.ref',
      'pull_request.draft',
    ]);
  });

  it('should deduplicate paths across events', () => {
    const eventsWithDupe: readonly GitHubEventDefinition[] = [
      {
        event: 'push',
        description: 'Push',
        category: 'ci',
        actions: [],
        payloadPaths: [{ path: 'ref', description: 'Branch ref' }],
      },
      {
        event: 'create',
        description: 'Create',
        category: 'ci',
        actions: [],
        payloadPaths: [{ path: 'ref', description: 'Ref name' }],
      },
    ];

    const paths = getPayloadPathsForEvents({
      events: ['push', 'create'],
      allEvents: eventsWithDupe,
    });

    expect(paths).toHaveLength(1);
    expect(paths[0]!.path).toBe('ref');
  });

  it('should handle events without payloadPaths', () => {
    const paths = getPayloadPathsForEvents({
      events: ['issues.labeled'],
      allEvents,
    });

    expect(paths).toHaveLength(0);
  });

  it('should extract base event name from compound events', () => {
    const paths = getPayloadPathsForEvents({
      events: ['pull_request.opened'],
      allEvents,
    });

    expect(paths).toHaveLength(2);
    expect(paths[0]!.path).toBe('pull_request.base.ref');
  });

  it('should return empty array for no events', () => {
    const paths = getPayloadPathsForEvents({ events: [], allEvents });

    expect(paths).toHaveLength(0);
  });
});
